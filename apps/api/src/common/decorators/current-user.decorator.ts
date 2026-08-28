import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

export interface UsuarioActual {
  id: string;
  email: string;
  role: 'ADMIN' | 'EDITOR';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioActual => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: UsuarioActual }>();
    if (!req.user) throw new Error('CurrentUser fuera de una ruta protegida');
    return req.user;
  },
);
