import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { StorageService } from '../../storage/storage.service.js';

/** `storageKey` → `url`, `posterKey` → `posterUrl`, `coverKey` → `coverUrl`… */
const SUFIJO = 'Key';

/**
 * El ÚNICO sitio del proyecto que conoce el dominio del CDN. Ningún servicio ni
 * componente lo ve, y en la base se guarda la key y nunca la URL: por eso cambiar
 * de proveedor no toca ni una fila (§17).
 */
@Injectable()
export class MediaUrlInterceptor implements NestInterceptor {
  constructor(private readonly storage: StorageService) {}

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((payload) => this.transformar(payload)));
  }

  private transformar(valor: unknown): unknown {
    if (Array.isArray(valor)) return valor.map((v) => this.transformar(v));
    if (valor === null || typeof valor !== 'object') return valor;
    if (valor instanceof Date) return valor;

    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      if (clave.endsWith(SUFIJO) && (typeof v === 'string' || v === null)) {
        // `storageKey` → `url`; `posterKey` → `posterUrl`.
        const base = clave.slice(0, -SUFIJO.length);
        const nombre = base === 'storage' ? 'url' : `${base}Url`;
        salida[nombre] = typeof v === 'string' ? this.storage.getPublicUrl(v) : null;
        continue;
      }
      salida[clave] = this.transformar(v);
    }
    return salida;
  }
}
