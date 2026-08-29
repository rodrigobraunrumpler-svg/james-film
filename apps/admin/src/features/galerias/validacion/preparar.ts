import type { MediaType } from '@james-film/contracts';
import { validarArchivo, validarMetadatosVideo, esVideo } from './archivo';
import { ErrorValidacion } from './errores';
import { extraerPoster as extraerPosterReal } from './extraer-poster';
import type { PosterExtraido } from './extraer-poster';
import { inspeccionarMp4, validarMp4 } from './faststart';
import type { CabeceraMp4 } from './faststart';
import { normalizarImagen as normalizarImagenReal } from './normalizar-imagen';
import type { ImagenNormalizada } from './normalizar-imagen';

export interface DepsPreparar {
  inspeccionar(archivo: File): Promise<CabeceraMp4>;
  extraerPoster(archivo: File): Promise<PosterExtraido>;
  normalizarImagen(archivo: File): Promise<ImagenNormalizada>;
}

export type Preparado =
  | {
      ok: true;
      archivo: File;
      /** Lo que se sube: la foto normalizada, o el vídeo tal cual. */
      blob: Blob;
      tipo: MediaType;
      width: number;
      height: number;
      durationSec?: number;
      poster?: Blob;
    }
  | { ok: false; archivo: File; motivo: string };

const depsReales = (): DepsPreparar => ({
  inspeccionar: (a) => inspeccionarMp4(a),
  extraerPoster: (a) => extraerPosterReal(a),
  normalizarImagen: (a) => normalizarImagenReal(a),
});

/**
 * La puerta del presign: lo que sale con `ok: false` **no entra en el lote**.
 * Importa porque la API valida los items juntos — un archivo malo tumbaría la
 * firma de los otros siete después de haberlos hecho esperar.
 *
 * El orden no es casual: primero lo que se sabe sin leer un byte, luego 64 KB
 * de cabecera, y solo al final la decodificación, que es lo caro en un iPhone.
 */
export async function prepararArchivo(
  archivo: File,
  tipo: MediaType,
  deps: DepsPreparar = depsReales(),
): Promise<Preparado> {
  const rechazo = (motivo: string): Preparado => ({ ok: false, archivo, motivo });

  const barato = validarArchivo(archivo);
  if (barato) return rechazo(barato);

  try {
    if (!esVideo(archivo)) {
      const imagen = await deps.normalizarImagen(archivo);
      return {
        ok: true,
        archivo,
        blob: imagen.blob,
        tipo,
        width: imagen.width,
        height: imagen.height,
      };
    }

    const cabecera = await deps.inspeccionar(archivo);
    const problema = validarMp4(archivo, cabecera);
    if (problema) return rechazo(problema);

    const { poster, width, height, durationSec } = await deps.extraerPoster(archivo);

    const metadatos = validarMetadatosVideo(archivo, { width, height, durationSec });
    if (metadatos) return rechazo(metadatos);

    return { ok: true, archivo, blob: archivo, tipo, width, height, durationSec, poster };
  } catch (e) {
    // La cola llama a esto por cada archivo: una excepción suelta tumbaría el
    // lote entero en vez de marcar solo el que falló.
    return rechazo(
      e instanceof ErrorValidacion
        ? e.message
        : `No se pudo preparar «${archivo.name}». Vuelve a exportarlo desde CapCut.`,
    );
  }
}
