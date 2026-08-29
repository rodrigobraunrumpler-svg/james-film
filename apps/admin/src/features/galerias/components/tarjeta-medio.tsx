'use client';

import type { AdminMediaDto } from '@james-film/contracts';
import { cola } from '../cola/store';
import type { ItemCola } from '../cola/tipos';

const ETIQUETAS: Record<ItemCola['estado'], string> = {
  SELECCIONADO: 'En cola',
  VALIDANDO: 'Comprobando…',
  EXTRAYENDO_POSTER: 'Sacando la miniatura…',
  FIRMANDO: 'Preparando…',
  SUBIENDO: 'Subiendo',
  CONFIRMANDO: 'Terminando…',
  LISTO: 'Listo',
  FALLIDO: 'No se pudo subir',
};

export interface DatosTarjeta {
  clave: string;
  galleryId: string;
  nombre: string;
  posterUrl?: string | null;
  medio?: AdminMediaDto;
  item?: ItemCola;
}

export function TarjetaMedio({ datos }: { datos: DatosTarjeta }) {
  const { item, medio } = datos;
  const subiendo = item && item.estado !== 'LISTO' && item.estado !== 'FALLIDO';
  const fallo = item?.estado === 'FALLIDO' ? item.motivo : (medio?.error ?? null);
  const porcentaje = Math.round((item?.progreso ?? 0) * 100);

  return (
    <li className="relative flex flex-col overflow-hidden rounded-lg border">
      {/* aspect-ratio reservado SIEMPRE: sin él, la miniatura al llegar empuja
          la grilla entera y el CLS se dispara. */}
      <div className="relative aspect-[9/16] bg-neutral-100">
        {datos.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 sirve el
          // poster ya dimensionado; next/image añadiría un optimizador que no
          // hace falta y que Vercel factura.
          <img src={datos.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}

        {subiendo && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2">
            <p className="text-xs text-white">
              {ETIQUETAS[item.estado]}
              {item.estado === 'SUBIENDO' && ` · ${porcentaje}%`}
            </p>
            {item.estado === 'SUBIENDO' && (
              <div
                className="mt-1 h-1 overflow-hidden rounded-full bg-white/30"
                role="progressbar"
                aria-valuenow={porcentaje}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Subiendo ${datos.nombre}`}
              >
                <div
                  className="h-full [transform-origin:left] bg-white"
                  style={{ transform: `scaleX(${porcentaje / 100})` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-2">
        <p className="truncate text-xs [overflow-wrap:anywhere]">{datos.nombre}</p>

        {fallo && (
          <p role="alert" className="text-xs text-red-600">
            {fallo}
          </p>
        )}

        <div className="flex gap-2">
          {item?.estado === 'FALLIDO' && (
            <button
              type="button"
              onClick={() => cola.reintentar(item.clientUploadId)}
              className="min-h-11 flex-1 rounded-md border text-xs font-medium"
            >
              Reintentar
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              // Mismo camino para cancelar, descartar y eliminar: el Media nace
              // PENDING en el presign, así que todos pasan por el DELETE.
              if (item) void cola.cancelar(item.clientUploadId);
              else if (medio) void cola.borrarMedio(medio.id, datos.galleryId);
            }}
            className="min-h-11 flex-1 rounded-md border text-xs font-medium"
          >
            {subiendo ? 'Cancelar' : 'Eliminar'}
          </button>
        </div>
      </div>
    </li>
  );
}
