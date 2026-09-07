import type { UploadPurpose } from '@james-film/contracts';
import { MIMES_FOTO, MIMES_VIDEO } from '../media/media.rules.js';

/**
 * SVG entra **solo aquí**, y solo para el logo y la firma. Es la única entrada
 * de SVG del proyecto: un SVG es un documento ejecutable, y la mitigación no es
 * sanearlo sino el ORIGEN — R2 se sirve desde el subdominio `media.`, distinto
 * al de la landing, así que un `<script>` dentro no toca ni sus cookies ni su
 * DOM. PNG y JPEG se aceptan igual: la firma manuscrita puede llegar escaneada.
 */
export const MIMES_MARCA = ['image/svg+xml', 'image/png', 'image/jpeg'] as const;

const MB = 1024 * 1024;

export interface ReglaProposito {
  /** Lo decide el SERVIDOR. El cliente no manda prefijos. */
  prefijo: string;
  mimes: readonly string[];
  /** Si falta, se usa `MAX_IMAGE_MB` del entorno. */
  maxBytes?: number;
}

/**
 * `covers/`, `avatars/` y `brand/` son prefijos NUEVOS: la lista de `CLAUDE.md`
 * solo cubría dos de las nueve claves de esta fase.
 */
export const PROPOSITOS: Record<UploadPurpose, ReglaProposito> = {
  PORTADA_CATEGORIA: { prefijo: 'covers', mimes: MIMES_FOTO },
  IMAGEN_PAQUETE: { prefijo: 'covers', mimes: MIMES_FOTO },
  AVATAR_TESTIMONIO: { prefijo: 'avatars', mimes: MIMES_FOTO },
  // La foto de James. En `avatars` y no en `brand`: es una persona, no una
  // marca, y `brand` es el único prefijo que acepta SVG.
  FOTO_PERFIL: { prefijo: 'avatars', mimes: MIMES_FOTO },
  CAPTURA_TESTIMONIO: { prefijo: 'screenshots', mimes: MIMES_FOTO },
  LOGO: { prefijo: 'brand', mimes: MIMES_MARCA, maxBytes: MB },
  FIRMA: { prefijo: 'brand', mimes: MIMES_MARCA, maxBytes: MB },
  OG: { prefijo: 'og', mimes: ['image/jpeg', 'image/png'] },
  // El hero autoplayea en cada visita: 1.5 MB es el techo de §4, muy por debajo
  // de MAX_VIDEO_MB. Con el límite de los vídeos normales colarían 200 MB.
  HERO_VIDEO: { prefijo: 'videos', mimes: MIMES_VIDEO, maxBytes: 1.5 * MB },
  /**
   * `MIMES_FOTO`, y NO `MIMES_POSTER` — que es de donde estaba copiado.
   *
   * `MIMES_POSTER` es JPEG a secas por un motivo que **aquí no aplica**: los
   * pósters de los reels los saca el NAVEGADOR con `canvas.toBlob`, y en Safari
   * el WebP no existe y cae a PNG sin lanzar error, así que el iPhone de James
   * no tendría miniatura nunca. Esa es una restricción del generador.
   *
   * La imagen de reserva del hero no la genera nadie: la elige James de su
   * carrete o de su disco. Con JPEG a secas, un PNG —una captura, un export—
   * pasaba el selector de archivos y moría en el presign con un 400. Ahora se
   * comporta como CUALQUIER otra imagen del panel: una regla en vez de dos.
   *
   * Lo que sigue fuera es lo que tiene motivo propio: SVG —documento
   * ejecutable, solo en `brand/`— y todo lo que no esté en la lista, porque el
   * mime decide la extensión y el `content-type` que se FIRMA, y una lista
   * abierta es la puerta a servir `text/html` bajo una clave `.jpg`.
   */
  HERO_POSTER: { prefijo: 'posters', mimes: MIMES_FOTO },
};

/** Los prefijos que el cron de la fase 6 puede barrer buscando huérfanos. */
export const PREFIJOS_BARRIBLES = ['covers', 'avatars', 'brand', 'og'] as const;
