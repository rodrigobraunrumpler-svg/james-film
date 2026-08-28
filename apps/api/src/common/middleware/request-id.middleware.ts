import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express' {
  interface Request {
    requestId?: string;
  }
}

/**
 * Un identificador por petición, presente desde la fase 2 y no desde la 6: las
 * fases 2 a 5 son donde más se depura, y un error sin correlación con el log
 * obliga a reproducirlo a ciegas. En la fase 6 lo hereda pino.
 *
 * Función plana, no clase inyectable: no tiene dependencias, y así vive en
 * `configurarApp` junto al resto del arranque en vez de en el módulo.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  // Se respeta el del proxy si viene, para poder seguir la traza entera.
  const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
