import {
  LADO_LARGO_FOTO,
  MAX_BITRATE_MBPS,
  MAX_IMAGE_BYTES,
  MAX_LADO_LARGO,
  MAX_VIDEO_BYTES,
  MIMES_FOTO,
  MIMES_VIDEO,
} from './limites';

/** Estructural a propósito: un `File` lo satisface y los tests no crean 300 MB. */
export interface ArchivoElegido {
  name: string;
  size: number;
  type: string;
}

export interface MetadatosVideo {
  width: number;
  height: number;
  durationSec: number;
}

/** HEIC no se rechaza: se convierte antes de subir. Es lo que da el iPhone. */
const MIMES_CONVERTIBLES = ['image/heic', 'image/heif'] as const;

const VIDEO = new Set<string>(MIMES_VIDEO);
const FOTO = new Set<string>([...MIMES_FOTO, ...MIMES_CONVERTIBLES]);

export const esVideo = (a: ArchivoElegido): boolean => a.type.startsWith('video/');

const mb = (bytes: number): string => `${Math.round(bytes / (1024 * 1024))} MB`;

/**
 * Lo que se puede saber SIN leer un byte del archivo. Se ejecuta al elegirlo,
 * antes de decodificar nada y mucho antes de pedir una firma.
 *
 * Devuelve el mensaje para James, o `null` si el archivo sirve.
 */
export function validarArchivo(a: ArchivoElegido): string | null {
  if (a.size <= 0) {
    return `«${a.name}» está vacío. Vuelve a exportarlo y súbelo otra vez.`;
  }

  if (esVideo(a) && !VIDEO.has(a.type)) {
    return (
      `«${a.name}» no es un MP4. Al exportar el vídeo, elige formato MP4 ` +
      `y códec H.264, y vuelve a subirlo.`
    );
  }

  if (a.type.startsWith('image/') && !FOTO.has(a.type)) {
    return `«${a.name}» tiene un formato de imagen que no se puede subir. Usa JPG o PNG.`;
  }

  if (!esVideo(a) && !a.type.startsWith('image/')) {
    return `«${a.name}» no es un vídeo ni una foto. Sube MP4, JPG o PNG.`;
  }

  const techo = esVideo(a) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (a.size > techo) {
    // Los DOS números: sin el suyo, James no sabe cuánto tiene que recortar.
    return esVideo(a)
      ? `«${a.name}» pesa ${mb(a.size)} y el máximo son ${mb(techo)}. ` +
          `Recórtalo, o vuelve a exportarlo a 1080p.`
      : `«${a.name}» pesa ${mb(a.size)} y el máximo son ${mb(techo)}.`;
  }

  return null;
}

/** Mbps reales del archivo. Duración 0 da Infinity, que el umbral ya rechaza. */
export const bitrateMbps = (bytes: number, segundos: number): number =>
  segundos > 0 ? (bytes * 8) / segundos / 1_000_000 : Infinity;

/**
 * Lo que solo se sabe DESPUÉS de leer los metadatos del vídeo. Va junto a la
 * extracción del poster, que es cuando ya tenemos dimensiones y duración.
 */
export function validarMetadatosVideo(a: ArchivoElegido, meta: MetadatosVideo): string | null {
  const { width, height, durationSec } = meta;

  if (!Number.isFinite(durationSec) || durationSec <= 0 || !width || !height) {
    // Si iOS no dio duración tampoco dio dimensiones fiables: firmarlo sería
    // subir 200 MB para descubrir el problema en el servidor.
    return (
      `No se pudieron leer los datos de «${a.name}». ` +
      `Vuelve a exportarlo en MP4 con códec H.264.`
    );
  }

  const ladoLargo = Math.max(width, height);
  if (ladoLargo > MAX_LADO_LARGO) {
    return (
      `«${a.name}» es de ${width}×${height} y el máximo es ${MAX_LADO_LARGO}px de lado largo. ` +
      `Vuelve a exportarlo a 1080p.`
    );
  }

  const bitrate = bitrateMbps(a.size, durationSec);
  if (bitrate > MAX_BITRATE_MBPS) {
    return (
      `«${a.name}» va a ${bitrate.toFixed(1)} Mbps y se trabaría en datos móviles ` +
      `(máximo ${MAX_BITRATE_MBPS}). Vuelve a exportarlo con menos calidad, o a 1080p.`
    );
  }

  return null;
}

/**
 * Encaja `w×h` dentro de un cuadrado de `max` conservando la proporción.
 * Nunca devuelve 0: una imagen de 10000×3 seguiría teniendo 1 px de alto.
 */
export function escalarA(
  width: number,
  height: number,
  max: number = LADO_LARGO_FOTO,
): { width: number; height: number } {
  const ladoLargo = Math.max(width, height);
  if (ladoLargo <= max) return { width, height };

  const factor = max / ladoLargo;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}
