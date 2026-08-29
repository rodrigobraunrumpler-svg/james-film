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

export interface AccionesTarjeta {
  posicion: number;
  total: number;
  onMover: (desde: number, hasta: number) => void;
  onPortada: (mediaId: string) => void;
}

export function TarjetaMedio({
  datos,
  acciones,
}: {
  datos: DatosTarjeta;
  acciones: AccionesTarjeta;
}) {
  const { item, medio } = datos;
  const subiendo = item && item.estado !== 'LISTO' && item.estado !== 'FALLIDO';
  const fallo = item?.estado === 'FALLIDO' ? item.motivo : (medio?.error ?? null);
  const porcentaje = Math.round((item?.progreso ?? 0) * 100);
  /** La portada solo tiene sentido sobre algo que existe y se puede servir. */
  const puedeSerPortada = medio?.status === 'READY';
  const { posicion, total } = acciones;

  return (
    <li
      className="relative flex flex-col overflow-hidden rounded-lg border bg-white"
      // Arrastre nativo, solo escritorio. En táctil no hace nada a propósito:
      // los botones de mover son lo que se usa con el pulgar (§10) y son el
      // mismo camino de código.
      draggable={!subiendo}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(posicion))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const desde = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isInteger(desde)) acciones.onMover(desde, posicion);
      }}
    >
      {/* aspect-ratio reservado SIEMPRE: sin él, la miniatura al llegar empuja
          la grilla entera y el CLS se dispara. */}
      <div className="relative aspect-[9/16] bg-neutral-100">
        {datos.posterUrl ? (
          <img src={datos.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}

        {medio?.isFeatured && (
          <span className="absolute top-1 left-1 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Portada
          </span>
        )}

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

        {/* Botones de mover: redundantes con el arrastre a propósito. Con más de
            ocho elementos en el móvil es lo único que se usa de verdad. */}
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={`Mover ${datos.nombre} antes`}
            disabled={posicion === 0}
            onClick={() => acciones.onMover(posicion, posicion - 1)}
            className="min-h-11 flex-1 rounded-md border text-xs disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            aria-label={`Mover ${datos.nombre} después`}
            disabled={posicion >= total - 1}
            onClick={() => acciones.onMover(posicion, posicion + 1)}
            className="min-h-11 flex-1 rounded-md border text-xs disabled:opacity-40"
          >
            →
          </button>
        </div>

        <div className="flex gap-1">
          {puedeSerPortada && !medio.isFeatured && (
            <button
              type="button"
              onClick={() => acciones.onPortada(medio.id)}
              className="min-h-11 flex-1 rounded-md border text-xs font-medium"
            >
              {/* «Hacer portada», no «Portada»: la etiqueta de arriba es el
                  ESTADO y esto es la ACCIÓN. Con la misma palabra, la tarjeta
                  ya marcada y la que no se leen igual. */}
              Hacer portada
            </button>
          )}
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
