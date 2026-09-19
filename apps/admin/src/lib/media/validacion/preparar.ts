import type { MediaType } from '@james-film/contracts';
import { bitrateMbps, validarArchivo, validarMetadatosVideo, esVideo } from './archivo';
import { ErrorValidacion } from './errores';
import { extraerPoster as extraerPosterReal } from './extraer-poster';
import type { PosterExtraido } from './extraer-poster';
import { inspeccionarMp4, validarMp4 } from './faststart';
import type { CabeceraMp4 } from './faststart';
import { normalizarImagen as normalizarImagenReal } from './normalizar-imagen';
import type { ImagenNormalizada } from './normalizar-imagen';
import { motivoParaRecodificar, recodificarAMp4 } from './recodificar';

/** Lo que la tesela enseña mientras prepara. `RECODIFICANDO` trae fracción. */
export type EtapaPreparacion = 'VALIDANDO' | 'RECODIFICANDO' | 'EXTRAYENDO_POSTER';

export interface DepsPreparar {
  inspeccionar(archivo: File): Promise<CabeceraMp4>;
  recodificar(archivo: File, onProgreso: (fraccion: number) => void): Promise<File>;
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
      /** Se sube igual; la tarjeta lo enseña en gris, no en rojo. */
      aviso?: string;
    }
  | { ok: false; archivo: File; motivo: string };

const depsReales = (): DepsPreparar => ({
  inspeccionar: (a) => inspeccionarMp4(a),
  recodificar: (a, p) => recodificarAMp4(a, p),
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
  /**
   * Para que la tarjeta diga «Comprobando…», «Convirtiendo…» y «Sacando la
   * miniatura…». La fracción solo llega durante la conversión, que es la única
   * etapa que tarda lo bastante como para que un usuario se pregunte si se
   * colgó — y por eso va con progreso REAL, no con un indeterminado.
   */
  onEtapa: (etapa: EtapaPreparacion, fraccion?: number) => void = () => {},
): Promise<Preparado> {
  const rechazo = (motivo: string): Preparado => ({ ok: false, archivo, motivo });

  onEtapa('VALIDANDO');
  const barato = validarArchivo(archivo);
  if (barato) return rechazo(barato);

  try {
    if (!esVideo(archivo)) {
      onEtapa('EXTRAYENDO_POSTER');
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

    /** Lo que se SUBE. Deja de ser el original en cuanto hay que convertir. */
    let fuente = archivo;
    let convertido = false;
    let aviso: string | null = null;

    const convertir = async (): Promise<void> => {
      onEtapa('RECODIFICANDO', 0);
      fuente = await deps.recodificar(archivo, (f) => onEtapa('RECODIFICANDO', f));
      convertido = true;
      // Lo que sale ya es H.264 1080p con faststart, así que el aviso de
      // arranque lento deja de aplicar aunque el original lo tuviera.
      aviso = null;
    };

    if (motivoParaRecodificar(cabecera)) {
      // HEVC: se sabe con 64 KB y sin decodificar nada, así que se convierte
      // antes de tocar el decodificador. Y se convierte en vez de rechazar
      // porque el iPhone de James lo graba así salvo que alguien se acuerde de
      // un ajuste — y acordarse no es una solución.
      await convertir();
    } else {
      const revision = validarMp4(archivo, cabecera);
      if (revision.error) return rechazo(revision.error);
      aviso = revision.aviso;
    }

    onEtapa('EXTRAYENDO_POSTER');
    let { poster, width, height, durationSec } = await deps.extraerPoster(fuente);

    // Segunda oportunidad: el 4K y el bitrate solo se saben DESPUÉS de leer los
    // metadatos. Un clip de cámara puede venir en H.264 y aun así no caber.
    if (
      !convertido &&
      motivoParaRecodificar(cabecera, {
        width,
        height,
        bitrateMbps: bitrateMbps(fuente.size, durationSec),
      })
    ) {
      await convertir();
      onEtapa('EXTRAYENDO_POSTER');
      ({ poster, width, height, durationSec } = await deps.extraerPoster(fuente));
    }

    // Se valida SIEMPRE lo que se va a subir, convertido o no: si la conversión
    // no bastó, esto es lo que lo dice en vez de subir algo que la web rechaza.
    const metadatos = validarMetadatosVideo(fuente, { width, height, durationSec });
    if (metadatos) return rechazo(metadatos);

    return {
      ok: true,
      archivo,
      blob: fuente,
      tipo,
      width,
      height,
      durationSec,
      poster,
      ...(aviso ? { aviso } : {}),
    };
  } catch (e) {
    // La cola llama a esto por cada archivo: una excepción suelta tumbaría el
    // lote entero en vez de marcar solo el que falló.
    return rechazo(
      e instanceof ErrorValidacion
        ? e.message
        : `No se pudo preparar «${archivo.name}». Vuelve a exportarlo en MP4 con códec H.264.`,
    );
  }
}
