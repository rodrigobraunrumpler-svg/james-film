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

/**
 * `video/quicktime` SE SUBE, no solo se inspecciona. **El iPhone graba `.MOV`
 * siempre**, con cualquier ajuste de cámara, así que rechazarlo condenaba a
 * James a convertir cada archivo a mano — y la premisa del bloqueo («Firefox no
 * reproduce contenedores QuickTime») resultó FALSA al medirla: decodifica en
 * Firefox y en Chromium servido como `video/quicktime`.
 *
 * Lo que se sigue bloqueando es el HEVC, en `validarMp4`, y ahí la diferencia
 * es real: el contenedor lo demultiplexa el navegador siempre, mientras que
 * decodificar HEVC depende del hardware del visitante.
 *
 * Espejo de `MIMES_VIDEO` en `apps/api/src/modules/media/media.rules.ts`: si
 * divergen, James sube 200 MB por 4G y el presign rechaza el lote al final.
 */
export const MIMES_VIDEO = ['video/mp4', 'video/quicktime'] as const;
export const MIMES_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** El poster SIEMPRE JPEG: `toBlob('image/webp')` no existe en Safari. */
export const MIME_POSTER = 'image/jpeg';
