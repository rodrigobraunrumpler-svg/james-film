'use client';

import type { UploadPurpose } from '@james-film/contracts';
import { useRef, useState } from 'react';
import { Film, Image as ImageIcon } from 'lucide-react';
import { clasesBoton } from './boton';
import { ApiError } from '@/lib/api/errors';
import { subirImagen } from '@/lib/media/subir-imagen';
import { ErrorValidacion } from '@/lib/media/validacion/errores';

/**
 * Lo que el selector OFRECE tiene que ser lo que el servidor ACEPTA.
 *
 * Cuando no coinciden, el fallo es de los peores: eliges un archivo que el
 * sistema te dejó elegir, se sube, y el presign lo rechaza con un 400. Pasaba en
 * dos sitios y llevaba desde que existen los dos campos:
 *
 *  · `OG` acepta JPEG y PNG, y el defecto ofrecía WebP también.
 *
 * `HERO_POSTER` estaba en la misma lista y se ha resuelto por el otro lado: en
 * la API aceptaba solo JPEG porque tenía copiada la regla de los pósters que
 * saca el navegador, y ahí no aplicaba. Ahora acepta lo mismo que el resto de
 * imágenes, así que le vale el valor por defecto.
 *
 * HEIC y HEIF sí se ofrecen donde el destino es JPEG: es lo que da el iPhone y
 * `normalizarImagen` lo convierte ANTES de pedir la firma, así que lo que llega
 * al servidor ya es un JPEG. Es la única conversión, y por eso PNG y WebP no
 * pueden colarse igual: ésos viajan tal cual.
 */
const ACEPTA: Record<string, string> = {
  LOGO: 'image/svg+xml,image/png,image/jpeg',
  FIRMA: 'image/svg+xml,image/png,image/jpeg',
  HERO_VIDEO: 'video/mp4',
  OG: 'image/jpeg,image/png,image/heic,image/heif',
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
  /**
   * Lo que se enseña MIENTRAS no se guarda, en tres estados:
   *
   * - `undefined` — nadie ha tocado nada: manda `valorUrl`, lo que hay en la base.
   * - `string`    — se acaba de subir un archivo: su URL local.
   * - `null`      — se ha pulsado «Quitar».
   *
   * El `null` es la razón de que esto sea un estado propio y no un booleano:
   * antes «Quitar» hacía `setPrevia(null)` y la miniatura **volvía a salir**,
   * porque `previa ?? valorUrl` caía otra vez en la URL del padre — que no
   * cambia hasta guardar y refetchear. Cada pantalla lo apañaba por su cuenta
   * con un `xKey === null ? null : url`, y **seis de las nueve se olvidaron**.
   * El componente que tiene el botón es el que tiene que saberlo.
   */
  const [local, setLocal] = useState<string | null | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);

  const elegir = async (archivo: File | undefined): Promise<void> => {
    if (!archivo) return;
    setError(null);
    setProgreso(0);

    try {
      const { key } = await subirImagen({ archivo, proposito, onProgreso: setProgreso });
      // La vista previa sale del archivo local, no de la URL del CDN: el objeto
      // acaba de subirse y pedirlo al CDN daría un 404 durante unos segundos.
      //
      // Se revoca el anterior antes de crear el nuevo: un `objectURL` retiene
      // el archivo entero en memoria hasta que se suelta, y aquí se cambia de
      // imagen tantas veces como haga falta hasta dar con la buena.
      setLocal((previo) => {
        if (previo) URL.revokeObjectURL(previo);
        return URL.createObjectURL(archivo);
      });
      onChange(key);
    } catch (e) {
      /**
       * El mensaje del SERVIDOR también vale, y era el que se estaba tirando.
       *
       * El presign contesta «Este tipo de archivo no vale aquí. Usa JPEG.» o «El
       * archivo pesa 4 MB y el máximo aquí son 2 MB» — que es exactamente lo que
       * pide la regla de «los errores dicen qué hacer»— y aquí se sustituía por
       * «No se pudo subir. Inténtalo otra vez.», que además miente: reintentar
       * con el mismo archivo falla siempre.
       *
       * Solo los 4xx: un 500 o un corte de red traen mensajes que no le dicen
       * nada a James, y ahí sí es cierto que reintentar es lo que toca.
       */
      const delServidor = e instanceof ApiError && e.status >= 400 && e.status < 500;
      setError(
        e instanceof ErrorValidacion || delServidor
          ? (e as Error).message
          : 'No se pudo subir. Inténtalo otra vez.',
      );
    } finally {
      setProgreso(null);
      if (input.current) input.current.value = '';
    }
  };

  const mostrada = local === undefined ? valorUrl : local;
  const esVideo = (ACEPTA[proposito] ?? POR_DEFECTO).startsWith('video/');

  return (
    <div className="flex flex-col gap-1.25">
      <span className="text-muted text-xs">{etiqueta}</span>

      <div
        className="border-line bg-well rounded-control relative max-h-56 overflow-hidden border"
        // `aspect-ratio` SIEMPRE reservado: sin él, la miniatura al llegar
        // empuja el formulario entero y el salto se ve. Con techo, eso sí: una
        // caja 16:9 a ancho completo se comía media hoja estando vacía.
        style={{ aspectRatio: proporcion }}
      >
        {mostrada && esVideo ? (
          /* Un <img> con un .mp4 dentro pinta el icono de imagen rota, y eso es
             lo que salía en «Vídeo del hero» en cuanto había uno guardado —y
             también justo después de subirlo, con el blob local—. Se previsualiza
             como se va a ver en la web: en bucle y en silencio. */
          <video
            src={mostrada}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-contain"
          />
        ) : mostrada ? (
          <img src={mostrada} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          // Vacía dice qué se espera. Un rectángulo negro sin nada no distingue
          // «no hay imagen» de «no ha cargado». Y si lo que va ahí es un vídeo,
          // lo dice: «Sin imagen» bajo la etiqueta «Vídeo del hero» son dos
          // palabras distintas para la misma caja.
          <span className="text-ash absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-xs">
            {esVideo ? <Film className="size-5" aria-hidden /> : <ImageIcon className="size-5" aria-hidden />}
            {esVideo ? 'Sin vídeo' : 'Sin imagen'}
          </span>
        )}

        {progreso !== null && (
          <div className="absolute inset-x-0 bottom-0 p-2 [background:var(--color-velo)]">
            {/* Progreso REAL, nunca indeterminado: es lo único que distingue
                «va lento» de «se colgó». */}
            <div
              className="bg-line h-1 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={Math.round(progreso * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Subiendo ${etiqueta}`}
            >
              <div
                className="bg-brass h-full origin-left transition-transform duration-300"
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
          className={clasesBoton('secundario', 'flex-1')}
        >
          {progreso !== null ? 'Subiendo…' : mostrada ? 'Cambiar' : 'Elegir archivo'}
        </button>

        {mostrada && progreso === null && (
          <button
            type="button"
            onClick={() => {
              setLocal((previo) => {
                if (previo) URL.revokeObjectURL(previo);
                return null;
              });
              // null BORRA la clave; omitirla la dejaría en la base.
              onChange(null);
            }}
            className={clasesBoton()}
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

      {ayuda && !error && <p className="text-muted text-xs">{ayuda}</p>}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
