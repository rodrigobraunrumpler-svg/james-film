'use client';

import type { MediaType } from '@james-film/contracts';
import { Film, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Boton } from '@/components/shared/boton';
import { ocultarSiFalla } from '@/lib/imagen';
import { tamano } from '@/lib/format';
import { cola } from '@/lib/media/cola/store';
import { validarArchivo } from '@/lib/media/validacion/archivo';
import { cn } from '@/lib/utils/cn';

interface Elegido {
  archivo: File;
  tipo: MediaType;
  /** Lo que ya se sabe SIN leer un byte. `null` = sirve. */
  motivo: string | null;
}

const tipoInicial = (a: File): MediaType => (a.type.startsWith('image/') ? 'PHOTO' : 'REEL');

/** Identidad de un archivo del carrete. `name` solo no basta: iOS repite nombres. */
const clave = (a: File): string => `${a.name}|${a.size}|${a.lastModified}`;

export interface Seleccion {
  elegidos: Elegido[];
  encima: boolean;
  input: RefObject<HTMLInputElement | null>;
  anadir: (lista: FileList | null) => void;
  quitar: (i: number) => void;
  cambiarTipo: (i: number, tipo: MediaType) => void;
  abrir: () => void;
  setEncima: (v: boolean) => void;
  vaciar: () => void;
  subir: () => void;
}

/**
 * El estado vive aquí y no dentro de la tesela porque lo comparten dos piezas
 * que están en sitios distintos de la pantalla: la tesela dentro de la grilla y
 * el resumen del lote encima. Con estado en cada una, arrastrar sobre la tesela
 * no llenaría el resumen.
 */
export function useSeleccionArchivos(galleryId: string): Seleccion {
  const [elegidos, setElegidos] = useState<Elegido[]>([]);
  const [encima, setEncima] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return {
    elegidos,
    encima,
    input,
    setEncima,
    anadir: (lista) => {
      if (!lista?.length) return;
      setElegidos((previos) => {
        // El selector de iOS no impide elegir dos veces el mismo archivo, y la
        // cola genera un `clientUploadId` nuevo por item: sin este filtro el
        // reel se sube DOS veces y sale duplicado en la galería.
        const vistos = new Set(previos.map((p) => clave(p.archivo)));
        return [
          ...previos,
          ...Array.from(lista)
            .filter((a) => !vistos.has(clave(a)))
            .map((archivo) => ({
              archivo,
              tipo: tipoInicial(archivo),
              // Síncrono y sin leer el archivo: tipo, tamaño y nombre. Decirle a
              // James que ese MOV no vale ANTES de pulsar Subir cuesta cero; con
              // la comprobación solo al subir, un MOV de 340 MB se ve igual que
              // un reel bueno y revienta medio minuto después, con los datos ya
              // gastados. Lo que sí necesita leer bytes —4K, HEVC, bitrate—
              // sigue fallando en la tesela, que es donde se puede reintentar.
              motivo: validarArchivo(archivo),
            })),
        ];
      });
    },
    quitar: (i) => setElegidos((previos) => previos.filter((_, j) => j !== i)),
    cambiarTipo: (i, tipo) =>
      setElegidos((previos) => previos.map((p, j) => (j === i ? { ...p, tipo } : p))),
    abrir: () => input.current?.click(),
    vaciar: () => {
      setElegidos([]);
      if (input.current) input.current.value = '';
    },
    subir: () => {
      cola.anadir(
        galleryId,
        elegidos.filter((e) => !e.motivo),
      );
      // Los rechazados NO se limpian: si se fueran con los buenos, el aviso
      // desaparecería en el mismo gesto que lo genera y James nunca sabría que
      // se han quedado dos fuera.
      setElegidos((previos) => previos.filter((e) => e.motivo));
      if (input.current) input.current.value = '';
    },
  };
}

/** Una casilla más de la grilla, no un bloque aparte: se suelta donde se ve. */
export function TeselaSoltar({ seleccion }: { seleccion: Seleccion }) {
  const { encima, setEncima, anadir, abrir, input } = seleccion;

  return (
    // El input va FUERA del botón: dentro, su `click()` programático burbujea
    // al onClick del botón, que vuelve a llamarlo — recursión infinita.
    <div className="relative">
      <button
        type="button"
        onClick={abrir}
        aria-label="Elegir archivos"
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          anadir(e.dataTransfer.files);
        }}
        className={cn(
          'flex aspect-3/4 w-full flex-col items-center justify-center gap-2 rounded-[7px] border border-dashed px-2 text-center transition-colors duration-150',
          encima
            ? 'border-brass bg-brass/10'
            : 'border-brass hover:bg-brass/10 bg-[rgba(201,169,106,.04)]',
        )}
      >
        <Upload className="text-brass size-[19px]" strokeWidth={1.6} aria-hidden />
        <span className="text-brass text-xs">Arrastra tus reels</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        // `capture` NO: abriría la cámara en vez del carrete, que es donde
        // aterriza lo que James exporta de su editor.
        accept="video/mp4,image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(e) => anadir(e.target.files)}
        className="sr-only"
      />
    </div>
  );
}

/** Un lote curado son ~9 medios: con 6 se ve la mayoría y no se come la pantalla. */
const VISIBLES = 6;

/** ~300 MB es más de un evento entero (§2: reel 35 MB, aftermovie 115 MB). */
const LOTE_GRANDE = 300 * 1024 ** 2;

const TIPOS = [
  { valor: 'REEL', etiqueta: 'Reel' },
  { valor: 'AFTERMOVIE', etiqueta: 'Aftermovie' },
] as const;

/** `IMG_4821.MP4` → `IMG_4821` / `.MP4`. Sin punto, todo es raíz. */
const raiz = (n: string): string => (n.includes('.') ? n.slice(0, n.lastIndexOf('.')) : n);
const sufijo = (n: string): string => (n.includes('.') ? n.slice(n.lastIndexOf('.')) : '');

/**
 * El total del lote se enseña ANTES de empezar y en grande: sin ese dato James
 * arranca 230 MB por datos móviles sin saberlo, y ya está calculado.
 *
 * Sin aviso condicional por tipo de red: `navigator.connection` no existe en
 * Safari y una heurística inventada mentiría.
 */
export function ResumenLote({ seleccion }: { seleccion: Seleccion }) {
  const { elegidos, quitar, cambiarTipo, subir, vaciar } = seleccion;
  const [expandido, setExpandido] = useState(false);
  const cabecera = useRef<HTMLHeadingElement>(null);
  const habia = useRef(0);

  // Se enfoca el encabezado cuando el lote pasa de 0 a n: mueve el foco de un
  // lector de pantalla —hoy nadie anuncia que se han añadido 12 archivos— y de
  // paso el navegador desplaza hasta ahí sin secuestrar el scroll.
  useEffect(() => {
    if (habia.current === 0 && elegidos.length > 0) cabecera.current?.focus();
    habia.current = elegidos.length;
  }, [elegidos.length]);

  // Lote vacío → nada. Una tarjeta vacía sería un hueco permanente, y el estado
  // vacío ya lo cubre la tesela de soltar dentro de la grilla.
  if (elegidos.length === 0) return null;

  const validos = elegidos.filter((e) => !e.motivo);
  const rechazados = elegidos.filter((e) => e.motivo);
  const total = validos.reduce((n, e) => n + e.archivo.size, 0);
  const videos = validos.filter((e) => !e.archivo.type.startsWith('image/')).length;
  const fotos = validos.length - videos;

  // Los rechazados van arriba y no se colapsan nunca: son los que piden acción.
  const filas = [...rechazados, ...(expandido ? validos : validos.slice(0, VISIBLES))];
  const ocultos = expandido ? 0 : Math.max(0, validos.length - VISIBLES);

  return (
    <section
      aria-labelledby="lote-titulo"
      className="border-line-strong bg-card rounded-card overflow-hidden"
    >
      <div className="border-line flex flex-col gap-2.5 border-b p-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-3.5 lg:py-2.5">
        <div className="min-w-0">
          {/* 15px/600 contra 11px ash: la jerarquía sale del CONTRASTE con el
              vecino, no de agrandar. 17px competiría con el h1 de la pantalla.
              `tabular-nums` para que el número no baile al quitar archivos. */}
          <h2
            id="lote-titulo"
            ref={cabecera}
            tabIndex={-1}
            className="text-lg font-semibold tabular-nums outline-none"
          >
            {tamano(total)}
          </h2>
          <p className="text-ash mt-0.5 text-xs">
            {validos.length} {validos.length === 1 ? 'archivo' : 'archivos'}
            {videos > 0 && ` · ${videos} ${videos === 1 ? 'vídeo' : 'vídeos'}`}
            {fotos > 0 && ` · ${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Con un solo archivo, «Vaciar» y la X de su fila son el mismo botón
              dos veces. */}
          {elegidos.length > 1 && (
            <Boton variante="fantasma" onClick={vaciar}>
              Vaciar
            </Boton>
          )}
          <Boton
            variante="principal"
            // La acción va en la CABECERA: al final de una lista de 20 se
            // quedaría fuera de pantalla justo cuando más se necesita.
            className="flex-1 lg:flex-none"
            disabled={validos.length === 0}
            onClick={subir}
          >
            {validos.length === 1 ? 'Subir el archivo' : `Subir ${validos.length}`}
          </Boton>
        </div>
      </div>

      {/* Un aviso agregado y no uno por fila: tres `role="alert"` seguidos son
          tres interrupciones al lector de pantalla por un mismo problema. */}
      {rechazados.length > 0 && (
        <p role="status" className="text-danger border-line border-b px-3 py-2 text-xs lg:px-3.5">
          {rechazados.length === 1
            ? '1 archivo no se puede subir. Míralo abajo y quítalo.'
            : `${rechazados.length} archivos no se pueden subir. Míralos abajo y quítalos.`}
        </p>
      )}

      <ul
        className={cn(
          'divide-line divide-y',
          // `overscroll-contain` para que el scroll no se encadene a la página
          // al llegar al final, que en iOS es lo que hace saltar el editor.
          expandido && 'max-h-76 overflow-y-auto overscroll-contain',
        )}
      >
        {filas.map((e) => {
          const i = elegidos.indexOf(e);
          const esVideo = !e.archivo.type.startsWith('image/');
          return (
            <li
              key={clave(e.archivo)}
              className={cn(
                // Móvil: 3 columnas y el selector cae a una segunda línea.
                // Escritorio: 4 columnas, todo en una. Mismo markup, un `lg:`.
                'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 px-3 py-2',
                'lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:gap-x-3 lg:px-3.5 lg:py-1.5',
                e.motivo && 'bg-danger-bg',
              )}
            >
              <Miniatura elegido={e} />

              <div className="min-w-0">
                {/* Truncar por el final se come la extensión, que es lo único
                    que distingue `IMG_4821.MP4` de `IMG_4821.MOV`. Se parte el
                    nombre y el sufijo se queda fijo. */}
                <p className="flex">
                  <span className="truncate">{raiz(e.archivo.name)}</span>
                  <span className="text-ash shrink-0">{sufijo(e.archivo.name)}</span>
                </p>
                {e.motivo ? (
                  <p className="text-danger mt-0.5 text-xs">{e.motivo}</p>
                ) : (
                  <p className="text-muted mt-0.5 text-xs tabular-nums">{tamano(e.archivo.size)}</p>
                )}
              </div>

              {/* Un archivo rechazado no va a ninguna parte: no se le elige tipo. */}
              {esVideo && !e.motivo && (
                <fieldset className="col-span-2 col-start-2 lg:col-span-1 lg:col-start-3 lg:row-start-1">
                  <legend className="sr-only">Tipo de {e.archivo.name}</legend>
                  {/* Radios de verdad bajo `sr-only`: teclado, flechas y lector
                      de pantalla salen gratis. El `<select>` nativo funcionaba
                      igual pero pesaba más que el archivo al que califica. */}
                  <div className="border-line-strong divide-line-strong rounded-control inline-flex divide-x overflow-hidden border">
                    {TIPOS.map((t) => (
                      <label key={t.valor} className="relative">
                        <input
                          type="radio"
                          name={`tipo-${i}`}
                          value={t.valor}
                          checked={e.tipo === t.valor}
                          onChange={() => cambiarTipo(i, t.valor)}
                          className="peer sr-only"
                        />
                        {/* Latón como ESTADO ACTIVO: texto y fondo al 10%.
                            Nunca un relleno sólido. */}
                        <span className="peer-checked:bg-brass/10 peer-checked:text-brass peer-focus-visible:outline-brass text-ash flex min-h-11 cursor-pointer items-center justify-center px-3 text-xs transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 lg:min-h-7">
                          {t.etiqueta}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={`Quitar ${e.archivo.name}`}
                className="text-ash hover:text-bone rounded-control col-start-3 row-start-1 flex size-11 shrink-0 items-center justify-center transition-colors duration-150 lg:col-start-4 lg:size-7"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          );
        })}

        {ocultos > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="text-ash hover:text-bone min-h-11 w-full px-3 text-left text-xs transition-colors duration-150 lg:min-h-8 lg:px-3.5"
            >
              Ver los {validos.length} · {ocultos} más
            </button>
          </li>
        )}
      </ul>

      {/* El único aviso que se queda: es lo que cambia la decisión de James
          —si esto es un lote de «déjalo corriendo» o de veinte segundos—. Sin
          color ni icono, porque no es un error. */}
      {total > LOTE_GRANDE && (
        <p className="text-ash border-line border-t px-3 py-2 text-xs lg:px-3.5">
          Es un lote grande: déjalo subiendo con la pantalla abierta.
        </p>
      )}
    </section>
  );
}

/**
 * Miniatura solo para FOTOS. Sacar un frame de un vídeo es abrir un
 * decodificador con timeout de 15 s y concurrencia 1 —y esa misma extracción ya
 * se hace veinte segundos después en la cola—: pagarla dos veces, por 4G, para
 * decorar un panel que vive cinco segundos, es el intercambio equivocado.
 *
 * El objectURL se revoca al desmontar. Sin eso, veinte fotos de 12 MP quedan
 * retenidas mientras viva la pestaña, y en el iPhone eso es la diferencia entre
 * subir y que Safari mate la pestaña a media subida.
 */
function Miniatura({ elegido }: { elegido: Elegido }) {
  const [url, setUrl] = useState<string | null>(null);
  const archivo = elegido.archivo;

  useEffect(() => {
    if (!archivo.type.startsWith('image/')) return;
    const u = URL.createObjectURL(archivo);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [archivo]);

  return (
    <div
      className={cn(
        // 3:4 igual que la grilla y que la tesela de soltar: es lo que hace que
        // el panel se lea como parte del editor y no como otro componente.
        'bg-well relative aspect-3/4 w-9 shrink-0 overflow-hidden rounded-[5px] border lg:w-8',
        elegido.motivo ? 'border-danger-line' : 'border-line',
      )}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover object-[center_35%]"
          onError={ocultarSiFalla}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          <Film className="text-muted size-3.5" aria-hidden />
        </span>
      )}
    </div>
  );
}
