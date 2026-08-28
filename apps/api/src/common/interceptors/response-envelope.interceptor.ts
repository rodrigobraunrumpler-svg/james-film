import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { ApiSuccess, PaginationMeta } from '@james-film/contracts';
import { map, type Observable } from 'rxjs';

/** Lo que devuelven los servicios de lista, antes de envolverse. */
export interface ListaPaginada<T> {
  items: T[];
  meta: PaginationMeta;
}

const esPaginada = <T>(v: unknown): v is ListaPaginada<T> =>
  typeof v === 'object' && v !== null && 'items' in v && 'meta' in v;

/**
 * Envuelve TODA respuesta correcta. De los errores se ocupa AllExceptionsFilter,
 * y ambos producen la misma forma.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiSuccess<unknown>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<unknown>> {
    return next.handle().pipe(
      map((payload): ApiSuccess<unknown> => {
        const timestamp = new Date().toISOString();

        if (esPaginada(payload)) {
          return { success: true, code: 'OK', data: payload.items, meta: payload.meta, timestamp };
        }
        return { success: true, code: 'OK', data: payload ?? null, timestamp };
      }),
    );
  }
}
