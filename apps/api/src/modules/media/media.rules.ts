import type { MediaType, Orientation } from '@james-film/contracts';

/**
 * Lista blanca, no negra. El acuerdo con James es MP4/H.264 (§4), así que un
 * .mov con HEVC ni siquiera llega a firmarse. HEIC tampoco aparece: el admin lo
 * convierte antes de subir porque Cloudflare no lo procesa.
 */
export const MIMES_VIDEO = ['video/mp4'] as const;
export const MIMES_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** El poster sale de `canvas.toBlob(..., 'image/webp')`: no hay otra opción válida. */
export const MIMES_POSTER = ['image/webp'] as const;

const EXTENSIONES: Record<string, string> = {
  'video/mp4': 'mp4',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
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
