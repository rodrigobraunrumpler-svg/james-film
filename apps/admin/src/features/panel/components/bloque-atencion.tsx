'use client';

import type { AttentionItemDto } from '@james-film/contracts';
import { X } from 'lucide-react';
import Link from 'next/link';
import { clasesBoton } from '@/components/shared/boton';
import { degradadoDe } from '@/lib/degradado';
import { relativo } from '@/lib/format';
import { ocultarSiFalla } from '@/lib/imagen';
import { cn } from '@/lib/utils/cn';

/** El filo izquierdo de cada fila, por gravedad decreciente. */
const FILO: Record<AttentionItemDto['kind'], string> = {
  DEPLOY_FAILED: 'border-l-danger',
  MEDIA_FAILED: 'border-l-brass',
  // Latón, como el fallo de un medio: no es rojo —no ha salido nada mal en la
  // web— pero es lo único de esta lista que James no sabe ya por su cuenta.
  EVENT_WITHOUT_GALLERY: 'border-l-brass',
  STALE_DRAFT: 'border-l-line-strong',
};

/**
 * ARRIBA del todo, antes que el número grande: si algo falló, saberlo importa
 * más que el total del mes. §9 lo pone debajo; se cambió a propósito.
 *
 * Cada aviso lleva SU ACCIÓN. Un aviso que no se puede resolver desde donde se
 * lee obliga a buscar la pantalla, y entonces se ignora.
 */
export function BloqueAtencion({
  avisos,
  alDescartar,
}: {
  avisos: AttentionItemDto[];
  alDescartar: (id: string) => void;
}) {
  if (avisos.length === 0) return null;

  return (
    <section
      className="entra bg-card border-line-strong rounded-card overflow-hidden border"
      style={{ '--i': 1 } as React.CSSProperties}
      aria-label="Requiere tu atención"
    >
      <header className="border-line flex items-center gap-2 border-b px-4 py-2.5">
        <span className="bg-danger size-1.5 shrink-0 rounded-full" aria-hidden />
        <h2 className="font-medium">Requiere tu atención</h2>
        <span className="text-muted ml-auto hidden text-xs sm:inline">
          Se descartan y no vuelven
        </span>
      </header>

      <ul>
        {avisos.map((a) => (
          <li
            key={a.id}
            className={cn(
              'border-line levanta bg-card flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0',
              // TRES niveles, no dos: rojo para lo que ya salió mal en la web,
              // latón para lo que hay que mirar, y la línea normal para el
              // recordatorio. Con solo `grave` las dos últimas filas quedaban
              // idénticas y la crítica perdía intensidad.
              'border-l-2',
              FILO[a.kind],
            )}
          >
            <Miniatura aviso={a} />

            <div className="min-w-0 flex-1 basis-40">
              <p className="dato">
                {a.title}
                {/* «hace 2 horas» pegado al titular, no en una línea aparte:
                    cuánto lleva roto es parte de qué está roto. */}
                {a.since && <span className="text-ash"> {relativo(a.since)}</span>}
              </p>
              <p className="text-muted dato mt-0.5 text-xs">{a.detail}</p>
            </div>

            {/* Los dos botones en su propio contenedor: con `flex-wrap` en la
                fila, el ✕ se descolgaba SOLO a una segunda línea en cuanto el
                texto no cabía —o sea, siempre en el móvil de James. */}
            <div className="flex shrink-0 items-center gap-2">
              <Link href={a.href} className={clasesBoton(a.grave ? 'principal' : 'secundario')}>
                {a.accion}
              </Link>
              <button
                type="button"
                onClick={() => alDescartar(a.id)}
                aria-label={`Descartar: ${a.title}`}
                className="text-muted border-line hover:border-line-hover hover:text-ash rounded-control flex size-11 shrink-0 items-center justify-center border transition-colors duration-150 lg:size-[30px]"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * La miniatura del evento del que se habla. Cuando no hay portada cae al
 * degradado de la galería —el mismo que la lista— para que «Boda Rojas» se
 * reconozca por su color, no solo por su nombre. Sin `galleryId` no hay nada
 * que pintar: es el aviso del deploy, que no es de ninguna galería.
 */
function Miniatura({ aviso }: { aviso: AttentionItemDto }) {
  if (!aviso.galleryId) return null;

  return (
    <span
      aria-hidden
      className={cn(
        // 9:16, que es el formato real del trabajo de James — el mismo que usa
        // la tesela del buscador. Dos aspectos para la misma miniatura era la
        // incoherencia que quedaba.
        'degradado aspect-[9/16] w-[26px] shrink-0 overflow-hidden rounded border',
        aviso.kind === 'MEDIA_FAILED' ? 'border-danger-line' : 'border-line',
      )}
      style={degradadoDe(aviso.galleryId)}
    >
      {aviso.coverUrl && (
        <img
          src={aviso.coverUrl}
          alt=""
          onError={ocultarSiFalla}
          className="size-full object-cover"
        />
      )}
    </span>
  );
}
