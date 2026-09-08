import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { DeployService } from '../../modules/deploy/deploy.service.js';
import { SIN_DEPLOY } from '../decorators/sin-deploy.decorator.js';

const MUTAN = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Cuenta el cambio y agenda el rebuild. Va en `@AdminController` y **en ningún
 * otro sitio**: son once controllers y 38 endpoints que mutan, así que ponerlo
 * a mano garantizaría que alguno se quedara fuera — y no fallaría, esa pantalla
 * simplemente dejaría de marcar cambios sin publicar.
 */
@Injectable()
export class TriggerDeployInterceptor implements NestInterceptor {
  constructor(
    private readonly deploy: DeployService,
    private readonly reflector: Reflector,
  ) {}

  intercept(contexto: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = contexto.switchToHttp().getRequest<Request>();
    const exento = this.reflector.get<boolean>(SIN_DEPLOY, contexto.getHandler());

    if (!MUTAN.has(req.method) || exento) return next.handle();

    // `tap` en el flujo de ÉXITO: una mutación que revienta no cambió nada, así
    // que contarla dejaría a James mirando «1 cambio sin publicar» que no existe.
    return next.handle().pipe(tap(() => void this.deploy.marcarCambio()));
  }
}
