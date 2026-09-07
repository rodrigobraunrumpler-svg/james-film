'use client';

import type { AdminMediaDto } from '@james-film/contracts';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { degradadoMedio } from '@/lib/degradado';
import { duracion } from '@/lib/format';
import { ocultarSiFalla } from '@/lib/imagen';
import { cn } from '@/lib/utils/cn';

const ES_VIDEO = new Set(['REEL', 'AFTERMOVIE']);

/**
 * Ver el archivo ENTERO. La tesela recorta a 3:4 —la grilla se lee así— y una
 * foto apaisada pierde los lados; aquí se ve completa, y un reel se reproduce
 * de verdad, que es como James comprueba que subió el que quería.
 *
 * `<dialog>` nativo y no una librería: trae foco atrapado, Escape, `::backdrop`
 * y el `inert` del resto de la página sin una sola línea. Lo único que hay que
 * poner es `showModal()`.
 */
export function VisorMedio({
  medios,
  indice,
  onCerrar,
  onMover,
}: {
  medios: AdminMediaDto[];
  indice: number | null;
  onCerrar: () => void;
  onMover: (indice: number) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const abierto = indice !== null;
  const medio = abierto ? medios[indice] : undefined;

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  // Flechas para pasar de uno a otro. Sin esto, revisar ocho reels son ocho
  // aperturas y ocho cierres.
  useEffect(() => {
    if (!abierto || indice === null) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && indice > 0) onMover(indice - 1);
      if (e.key === 'ArrowRight' && indice < medios.length - 1) onMover(indice + 1);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierto, indice, medios.length, onMover]);

  if (!medio || indice === null) return null;

  const esVideo = ES_VIDEO.has(medio.type);
  const tiempo = duracion(medio.durationSec);
  const nombre = medio.alt ?? (esVideo ? 'Vídeo' : 'Foto');

  return (
    <dialog
      ref={dialogo}
      onClose={onCerrar}
      // Cerrar al pulsar FUERA: el clic en el backdrop llega al propio dialog,
      // porque el contenido está en un hijo que lo detiene.
      onClick={(e) => {
        if (e.target === dialogo.current) onCerrar();
      }}
      aria-label={`Ver ${nombre}`}
      className="bg-content/95 text-bone backdrop:bg-well/80 m-0 h-dvh max-h-none w-dvw max-w-none p-0 backdrop:animate-[aparece_0.2s_ease_both] open:flex open:animate-[visor-entra_0.22s_cubic-bezier(0.2,0.8,0.2,1)_both] open:flex-col"
    >
      {/* El degradado de la propia tesela, muy suave: el archivo se recorta con
          `contain` y las bandas dejan de ser negras. Es el mismo color que ya
          identificaba a ese medio en la grilla, así que al abrirlo se reconoce. */}
      <div
        aria-hidden
        className="degradado pointer-events-none absolute inset-0 opacity-40"
        style={degradadoMedio(medio.id)}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="border-line/60 flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <p className="dato min-w-0 truncate">
            {nombre}
            <span className="text-ash">
              {' · '}
              {medio.width && medio.height ? `${medio.width}×${medio.height}` : medio.type}
              {tiempo ? ` · ${tiempo}` : ''}
            </span>
          </p>
          <p className="text-muted shrink-0 text-sm tabular-nums">
            {indice + 1} de {medios.length}
          </p>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="border-line-strong bg-card/70 hover:border-line-hover rounded-control flex size-11 shrink-0 items-center justify-center border transition-colors duration-150 lg:size-8"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Las flechas van SUPERPUESTAS, no en la fila: ocupando sitio le quitaban
            unos 110px de ancho al archivo, y en un móvil eso deja un vídeo
            apaisado del tamaño de un sello. Ahora el medio se lleva todo. */}
        <div className="relative flex min-h-0 flex-1 p-3 lg:p-6">
          <Paso hacia="anterior" visible={indice > 0} onClick={() => onMover(indice - 1)} />

          {/* `contain` y no `cover`: aquí el trabajo es VER el archivo entero. */}
          {esVideo ? (
            <video
              key={medio.id}
              src={medio.url}
              poster={medio.posterUrl ?? undefined}
              controls
              playsInline
              className="min-h-0 min-w-0 flex-1 animate-[aparece_0.2s_ease_both] self-stretch object-contain"
            />
          ) : (
            <img
              key={medio.id}
              src={medio.url}
              alt={medio.alt ?? ''}
              onError={ocultarSiFalla}
              className="min-h-0 min-w-0 flex-1 animate-[aparece_0.2s_ease_both] self-stretch object-contain"
            />
          )}

          <Paso
            hacia="siguiente"
            visible={indice < medios.length - 1}
            onClick={() => onMover(indice + 1)}
          />
        </div>
      </div>
    </dialog>
  );
}

/**
 * Superpuesta sobre el medio, centrada en vertical. Al no ocupar sitio no hace
 * falta reservarle hueco cuando no hay paso: nada se mueve al llegar al extremo.
 */
function Paso({
  hacia,
  visible,
  onClick,
}: {
  hacia: 'anterior' | 'siguiente';
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;
  const Icono = hacia === 'anterior' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hacia === 'anterior' ? 'Anterior' : 'Siguiente'}
      className={cn(
        'border-line-strong hover:border-line-hover text-bone rounded-control absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center border backdrop-blur-sm transition-colors duration-150 [background:var(--color-velo)] lg:size-10',
        hacia === 'anterior' ? 'left-2 lg:left-4' : 'right-2 lg:right-4',
      )}
    >
      <Icono className="size-5" aria-hidden />
    </button>
  );
}
