'use client';

import type { MediaType } from '@james-film/contracts';
import { useRef, useState } from 'react';
import { tamano } from '@/lib/format';
import { cola } from '../cola/store';

interface Elegido {
  archivo: File;
  tipo: MediaType;
}

const tipoInicial = (a: File): MediaType => (a.type.startsWith('image/') ? 'PHOTO' : 'REEL');

/**
 * El total del lote se enseña ANTES de empezar: `9 archivos · 230 MB`. Sin ese
 * dato, James arranca 230 MB por datos móviles sin saberlo — y ya está calculado.
 *
 * Sin aviso condicional por tipo de red: `navigator.connection` no existe en
 * Safari y una heurística inventada mentiría.
 */
export function ZonaSoltar({ galleryId }: { galleryId: string }) {
  const [elegidos, setElegidos] = useState<Elegido[]>([]);
  const [encima, setEncima] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const anadirArchivos = (lista: FileList | null): void => {
    if (!lista?.length) return;
    setElegidos((previos) => [
      ...previos,
      ...Array.from(lista).map((archivo) => ({ archivo, tipo: tipoInicial(archivo) })),
    ]);
  };

  const total = elegidos.reduce((n, e) => n + e.archivo.size, 0);

  const subir = (): void => {
    cola.anadir(galleryId, elegidos);
    setElegidos([]);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          anadirArchivos(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          encima ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300'
        }`}
      >
        <p className="text-sm text-neutral-600">Arrastra los reels aquí, o</p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-2 min-h-11 rounded-md border px-4 text-sm font-medium"
        >
          Elegir archivos
        </button>
        <input
          ref={input}
          type="file"
          multiple
          // `capture` NO: abriría la cámara en vez del carrete, que es donde
          // está lo que James exporta desde CapCut.
          accept="video/mp4,image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={(e) => anadirArchivos(e.target.files)}
          className="sr-only"
        />
      </div>

      {elegidos.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">
            {elegidos.length} {elegidos.length === 1 ? 'archivo' : 'archivos'} · {tamano(total)}
          </p>

          <ul className="flex flex-col gap-2">
            {elegidos.map((e, i) => (
              <li key={`${e.archivo.name}-${i}`} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate [overflow-wrap:anywhere]">
                  {e.archivo.name}
                </span>
                <span className="shrink-0 text-neutral-500">{tamano(e.archivo.size)}</span>
                {!e.archivo.type.startsWith('image/') && (
                  <select
                    aria-label={`Tipo de ${e.archivo.name}`}
                    value={e.tipo}
                    onChange={(ev) =>
                      setElegidos((previos) =>
                        previos.map((p, j) =>
                          j === i ? { ...p, tipo: ev.target.value as MediaType } : p,
                        ),
                      )
                    }
                    className="min-h-11 shrink-0 rounded-md border px-2"
                  >
                    <option value="REEL">Reel</option>
                    <option value="AFTERMOVIE">Aftermovie</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setElegidos((previos) => previos.filter((_, j) => j !== i))}
                  aria-label={`Quitar ${e.archivo.name}`}
                  className="min-h-11 shrink-0 px-2 text-neutral-500"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={subir}
            className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white"
          >
            Subir {elegidos.length === 1 ? 'el archivo' : `los ${elegidos.length} archivos`}
          </button>
        </div>
      )}
    </div>
  );
}
