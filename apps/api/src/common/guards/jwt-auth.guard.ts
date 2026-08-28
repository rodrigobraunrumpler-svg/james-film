import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import type { UsuarioActual } from '../decorators/current-user.decorator.js';

interface Payload {
  sub: string;
  email: string;
  role: 'ADMIN' | 'EDITOR';
}

/**
 * Sin Passport: §16 no lo exige y esto son veinte líneas. Passport añadiría tres
 * dependencias y una capa de estrategias para un único método de autenticación.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (esPublico) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: UsuarioActual }>();
    const [esquema, token] = req.headers.authorization?.split(' ') ?? [];
    if (esquema !== 'Bearer' || !token) throw new UnauthorizedException();

    try {
      const payload = await this.jwt.verifyAsync<Payload>(token);
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch {
      // Nunca se detalla por qué: expirado, firma inválida o malformado son la
      // misma información para quien no debería tener ninguna.
      throw new UnauthorizedException();
    }
  }
}
