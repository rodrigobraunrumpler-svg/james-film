/**
 * ESPEJO de los límites de la API (`MAX_VIDEO_MB` / `MAX_IMAGE_MB` en su env).
 * Si divergen, James sube 200 MB por 4G y el presign los rechaza al final —
 * y rechaza el LOTE ENTERO, porque valida los items juntos.
 */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Nunca 4K: el máster se queda en el disco de James, R2 es la vitrina (§4). */
export const MAX_LADO_LARGO = 2160;

/** Por encima se traba en datos móviles, que es como lo ven sus clientes. */
export const MAX_BITRATE_MBPS = 15;

/** Fotos: solo se tocan si superan esto o si son HEIC. */
export const LADO_LARGO_FOTO = 2560;

/** Un canvas por encima de ~100 MP falla en iOS sin decir por qué. */
export const MAX_MEGAPIXELES = 100;

/** Lo que se lee del archivo para mirar sus cajas. Nunca el archivo entero. */
export const CABECERA_BYTES = 64 * 1024;

export const MIMES_VIDEO = ['video/mp4'] as const;
export const MIMES_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** El poster SIEMPRE JPEG: `toBlob('image/webp')` no existe en Safari. */
export const MIME_POSTER = 'image/jpeg';
