import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../../common/hash.js';
import type { Session, User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** Alta entropía: SHA-256 es lo correcto, y además es lo único buscable con WHERE. */
const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  /**
   * Hash señuelo para que el login tarde lo mismo exista el usuario o no. Sin
   * esto, el email inexistente responde en ~1 ms y el existente gasta ~50 ms en
   * argon2: el reloj delata lo que el mensaje calla.
   */
  private readonly senuelo = hashPassword(randomBytes(32).toString('hex'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, userAgent?: string): Promise<Tokens> {
    const usuario = await this.prisma.user.findUnique({ where: { email } });

    const valida = usuario?.isActive
      ? await verifyPassword(usuario.passwordHash, password)
      : await verifyPassword(await this.senuelo, password).then(() => false);

    if (!usuario || !valida) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email o contraseña incorrectos',
      });
    }

    return this.crearSesion(usuario, userAgent);
  }

  async refresh(refreshToken: string): Promise<Tokens> {
    const hash = sha256(refreshToken);

    const sesion = await this.prisma.session.findFirst({
      where: { OR: [{ tokenHash: hash }, { prevHash: hash }], revokedAt: null },
      include: { user: true },
    });

    if (!sesion || sesion.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Tu sesión ha expirado',
      });
    }

    // Vino por prevHash: o es una carrera legítima, o es un token robado.
    if (sesion.prevHash === hash) {
      const graciaMs = this.config.getOrThrow<number>('REFRESH_GRACE_SECONDS') * 1000;
      const dentroDeLaVentana = Date.now() - sesion.updatedAt.getTime() < graciaMs;

      if (!dentroDeLaVentana) {
        // Señal de robo: se revoca la sesión entera, no solo este token.
        await this.prisma.session.update({
          where: { id: sesion.id },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException({
          code: 'SESSION_REVOKED',
          message: 'Cerramos tu sesión por seguridad. Vuelve a entrar.',
        });
      }
      // Dentro de la ventana se rota igual: solo guardamos hashes, así que no
      // podemos devolverle el token vigente al que llegó tarde. Ambos acaban
      // con un par válido y la cadena sigue.
    }

    return this.rotar(sesion);
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = sha256(refreshToken);
    await this.prisma.session.updateMany({
      where: { OR: [{ tokenHash: hash }, { prevHash: hash }], revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async crearSesion(usuario: User, userAgent?: string): Promise<Tokens> {
    const refreshToken = randomBytes(32).toString('hex');
    const dias = this.config.getOrThrow<number>('REFRESH_TTL_DAYS');

    await this.prisma.session.create({
      data: {
        userId: usuario.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + dias * 86_400_000),
        userAgent: userAgent?.slice(0, 255),
      },
    });

    return { accessToken: await this.firmar(usuario), refreshToken };
  }

  private async rotar(sesion: Session & { user: User }): Promise<Tokens> {
    const refreshToken = randomBytes(32).toString('hex');

    await this.prisma.session.update({
      where: { id: sesion.id },
      data: { prevHash: sesion.tokenHash, tokenHash: sha256(refreshToken) },
    });

    return { accessToken: await this.firmar(sesion.user), refreshToken };
  }

  private firmar(usuario: User): Promise<string> {
    return this.jwt.signAsync({ sub: usuario.id, email: usuario.email, role: usuario.role });
  }
}
