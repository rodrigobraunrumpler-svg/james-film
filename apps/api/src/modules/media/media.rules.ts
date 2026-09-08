import type { MediaType, Orientation } from '@james-film/contracts';

/**
 * Lista blanca, no negra. Lo que decide es el CÓDEC —H.264 sí, HEVC no—, no el
 * contenedor: el admin bloquea el HEVC leyendo la cabecera antes de pedir firma.
 * HEIC no aparece: el admin lo convierte antes de subir porque Cloudflare no lo
 * procesa.
 *
 * **`video/quicktime` entró MIDIENDO** (7-sep-2026). El iPhone graba `.MOV`
 * siempre, con cualquier ajuste de cámara, así que rechazarlo obligaba a James a
 * convertir cada archivo a mano. Se bloqueaba por «Firefox no reproduce
 * contenedores QuickTime», y eso resultó ser FALSO: servidos como
 * `video/quicktime`, un `.MOV` con H.264 decodifica en Firefox y en Chromium
 * —comprobado con `<video>` real, no con `canPlayType`—.
 *
 * Y la medida vale pese al aviso de CLAUDE.md sobre el Chromium empaquetado:
 * ese aviso es por los CÓDECS, que trae en su propio ffmpeg. Demultiplexar el
 * contenedor es código del navegador y no depende del hardware, así que aquí el
 * resultado sí es representativo. El HEVC se sigue bloqueando justo por lo
 * contrario: ahí sí decide el hardware de cada visitante.
 */
export const MIMES_VIDEO = ['video/mp4', 'video/quicktime'] as const;
export const MIMES_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
/**
 * JPEG, no WebP. `canvas.toBlob('image/webp')` NO existe en Safari —ni iOS ni macOS,
 * ninguna versión— y la especificación obliga a caer a PNG **sin lanzar error**. Con
 * WebP, en el iPhone de James ningún reel tendría poster jamás: o el presign rechaza
 * el lote entero, o el content-type firmado no cuadra y el bucket devuelve 403.
 *
 * Además es coherente con la regla de las fotos: nunca WebP propio, porque Cloudflare
 * re-comprime al servir y comprimir dos veces degrada. El poster lo sirve el mismo CDN.
 */
export const MIMES_POSTER = ['image/jpeg'] as const;

const EXTENSIONES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export const esVideo = (t: MediaType): boolean => t === 'REEL' || t === 'AFTERMOVIE';

export const prefijoDe = (t: MediaType): string => (esVideo(t) ? 'videos' : 'photos');

export const extensionDe = (mime: string): string => EXTENSIONES[mime] ?? 'bin';

/**
 * Se deriva de las dimensiones, no la elige el cliente: un valor a mano podría
 * contradecir al archivo y la grilla lo maquetaría mal.
 */
export function orientacionDe(width?: number | null, height?: number | null): Orientation {
  if (!width || !height) return 'VERTICAL';
  if (width > height) return 'HORIZONTAL';
  if (width < height) return 'VERTICAL';
  return 'SQUARE';
}
