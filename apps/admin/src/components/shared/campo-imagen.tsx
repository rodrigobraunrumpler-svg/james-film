'use client';

import type { UploadPurpose } from '@james-film/contracts';
import { useRef, useState } from 'react';
import { subirImagen } from '@/lib/media/subir-imagen';
import { ErrorValidacion } from '@/lib/media/validacion/errores';

const ACEPTA: Record<string, string> = {
  LOGO: 'image/svg+xml,image/png,image/jpeg',
  FIRMA: 'image/svg+xml,image/png,image/jpeg',
  HERO_VIDEO: 'video/mp4',
};
const POR_DEFECTO = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export interface CampoImagenProps {
  etiqueta: string;
  proposito: UploadPurpose;
  /** URL de la imagen actual, para la miniatura. La `key` no se pinta. */
  valorUrl?: string | null;
  /** Devuelve la KEY, no la URL: en la base va la key (§17). */
  onChange: (key: string | null) => void;
  /** Proporción de la miniatura. Reservada siempre, o la grilla salta. */
  proporcion?: string;
  ayuda?: string;
}

export function CampoImagen({
  etiqueta,
  proposito,
  valorUrl,
  onChange,
  proporcion = '16 / 9',
  ayuda,
}: CampoImagenProps) {
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const elegir = async (archivo: File | undefined): Promise<void> => {
    if (!archivo) return;
    setError(null);
    setProgreso(0);

    try {
      const { key } = await subirImagen({ archivo, proposito, onProgreso: setProgreso });
      // La vista previa sale del archivo local, no de la URL del CDN: el objeto
      // acaba de subirse y pedirlo al CDN daría un 404 durante unos segundos.
      setPrevia(URL.createObjectURL(archivo));
      onChange(key);
    } catch (e) {
      setError(e instanceof ErrorValidacion ? e.message : 'No se pudo subir. Inténtalo otra vez.');
    } finally {
      setProgreso(null);
      if (input.current) input.current.value = '';
    }
  };

  const mostrada = previa ?? valorUrl;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{etiqueta}</span>

      <div
        className="relative overflow-hidden rounded-md border bg-neutral-100"
        // `aspect-ratio` SIEMPRE reservado: sin él, la miniatura al llegar
        // empuja el formulario entero y el salto se ve.
        style={{ aspectRatio: proporcion }}
      >
        {mostrada && (
          <img src={mostrada} alt="" className="h-full w-full object-contain" loading="lazy" />
        )}

        {progreso !== null && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2">
            {/* Progreso REAL, nunca indeterminado: es lo único que distingue
                «va lento» de «se colgó». */}
            <div
              className="h-1 overflow-hidden rounded-full bg-white/30"
              role="progressbar"
              aria-valuenow={Math.round(progreso * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Subiendo ${etiqueta}`}
            >
              <div
                className="h-full [transform-origin:left] bg-white"
                style={{ transform: `scaleX(${progreso})` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={progreso !== null}
          className="min-h-11 flex-1 rounded-md border px-3 text-sm font-medium disabled:opacity-60"
        >
          {progreso !== null ? 'Subiendo…' : mostrada ? 'Cambiar' : 'Elegir archivo'}
        </button>

        {mostrada && progreso === null && (
          <button
            type="button"
            onClick={() => {
              setPrevia(null);
              // null BORRA la clave; omitirla la dejaría en la base.
              onChange(null);
            }}
            className="min-h-11 rounded-md border px-3 text-sm font-medium"
          >
            Quitar
          </button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACEPTA[proposito] ?? POR_DEFECTO}
        onChange={(e) => void elegir(e.target.files?.[0])}
        className="sr-only"
        aria-label={etiqueta}
      />

      {ayuda && !error && <p className="text-xs text-neutral-500">{ayuda}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
