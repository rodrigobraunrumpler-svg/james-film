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
      /**
       * DENTRO DE LA VENTANA NO SE ROTA, y aquí estaba el fallo que echaba a
       * James del panel cada quince minutos.
       *
       * Antes se rotaba igual, con el comentario «ambos acaban con un par
       * válido». No es cierto en cuanto hay MÁS DE DOS peticiones a la vez, que
       * es el caso normal: el panel dispara varias consultas al abrirse, el
       * access token acaba de caducar y salen cuatro 401 simultáneos. Los
       * cuatro llegan con el mismo token, los cuatro rotan escribiendo
       * `prevHash` desde SU lectura —ya obsoleta—, y solo sobreviven los dos
       * últimos eslabones. Reproducido: cuatro refrescos concurrentes emiten
       * cuatro tokens y **dos nacen muertos**.
       *
       * La pasarela guarda en la cookie el de la respuesta que llegue última.
       * Si le toca uno de los muertos, el siguiente 401 refresca con él, la API
       * responde `SESSION_EXPIRED` y la pasarela borra la cookie: «Tu sesión
       * caducó» con un refresh token de 30 días perfectamente bueno.
       *
       * Devolviendo el MISMO token que trajo el que llegó tarde, la ráfaga
       * entera emite como mucho dos tokens distintos —el rotado por el que
       * ganó y el que ya tenían los demás— y **los dos son válidos**: uno es
       * `tokenHash` y el otro `prevHash`. Caiga el que caiga en la cookie,
       * funciona.
       */
      return { accessToken: await this.firmar(sesion.user), refreshToken };
    }

    return this.rotar(sesion, refreshToken);
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

  /**
   * Rota con LOCK OPTIMISTA, y **una sola vez por ráfaga**.
   *
   * Dos fallos encadenados vivían aquí, y los dos echaban a James del panel:
   *
   * 1. `update` a secas escribía `prevHash` desde el `tokenHash` leído al
   *    principio. Con cuatro peticiones simultáneas —el panel abriendo y
   *    disparando varias consultas con el access token recién caducado— las
   *    cuatro encadenaban desde el MISMO eslabón y dos tokens quedaban
   *    huérfanos: ni `tokenHash` ni `prevHash`, o sea muertos sin que nadie se
   *    entere. Reproducido: de cuatro tokens emitidos, dos daban 401.
   *
   * 2. Con el lock puesto pero reintentando, el que perdía **volvía a rotar**,
   *    así que la cadena avanzaba un eslabón por petición y el token de partida
   *    se salía de la ventana de dos. Reproducido también: tres tokens
   *    distintos y el primero muerto.
   *
   * Lo que lo cierra es no reintentar: si otro ya rotó desde nuestro token,
   * **el nuestro es ahora `prevHash` y sigue siendo válido**, así que se
   * devuelve tal cual —igual que en la ventana de gracia—. La ráfaga entera
   * emite como mucho dos tokens y los dos valen, caiga el que caiga en la
   * cookie de la pasarela.
   */
  private async rotar(sesion: Session & { user: User }, presentado: string): Promise<Tokens> {
    const refreshToken = randomBytes(32).toString('hex');
    const actual = sha256(presentado);

    const { count } = await this.prisma.session.updateMany({
      where: { id: sesion.id, tokenHash: actual, revokedAt: null },
      data: { prevHash: actual, tokenHash: sha256(refreshToken) },
    });

    return {
      accessToken: await this.firmar(sesion.user),
      refreshToken: count === 1 ? refreshToken : presentado,
    };
  }

  private firmar(usuario: User): Promise<string> {
    return this.jwt.signAsync({ sub: usuario.id, email: usuario.email, role: usuario.role });
  }
}
