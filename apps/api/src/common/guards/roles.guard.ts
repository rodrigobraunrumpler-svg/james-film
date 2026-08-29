import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UsuarioActual } from '../decorators/current-user.decorator.js';
import { ROLES } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<UsuarioActual['role'][]>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!requeridos?.length) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: UsuarioActual }>();
    if (!req.user || !requeridos.includes(req.user.role)) throw new ForbiddenException();
    return true;
  }
}
