import { escalarA } from './archivo';
import { ErrorValidacion } from './errores';
import type { CanvasLike } from './extraer-poster';
import { LADO_LARGO_FOTO, MAX_MEGAPIXELES } from './limites';

export interface Dimensiones {
  width: number;
  height: number;
}

export interface BitmapLike extends Dimensiones {
  close?: () => void;
}

export interface DepsImagen {
  decodificar(blob: Blob, opciones: { imageOrientation: 'from-image' }): Promise<BitmapLike>;
  crearCanvas(): CanvasLike;
}

export interface ImagenNormalizada extends Dimensiones {
  blob: Blob;
}

/** El iPhone da HEIC y Cloudflare no lo procesa: hay que convertirlo sí o sí. */
const CONVERTIBLES = new Set(['image/heic', 'image/heif']);

export const depsImagen = (): DepsImagen => ({
  decodificar: (blob, opciones) => createImageBitmap(blob, opciones),
  crearCanvas: () => document.createElement('canvas') as unknown as CanvasLike,
});

/**
 * Solo se toca una foto si es HEIC o si pasa de 2560px de lado largo (§4).
 * Nunca WebP propio: Cloudflare re-comprime al servir y comprimir dos veces
 * degrada — por eso lo que ya cumple sale intacto.
 */
export function planImagen(archivo: { type: string }, dim: Dimensiones): 'tal-cual' | 'convertir' {
  if (CONVERTIBLES.has(archivo.type)) return 'convertir';
  return Math.max(dim.width, dim.height) > LADO_LARGO_FOTO ? 'convertir' : 'tal-cual';
}

export async function normalizarImagen(
  archivo: File,
  deps: DepsImagen = depsImagen(),
): Promise<ImagenNormalizada> {
  let bitmap: BitmapLike;
  try {
    // `from-image` aplica la orientación EXIF al decodificar. Sin esto, una
    // foto vertical del iPhone sale tumbada y no hay forma de arreglarlo luego.
    bitmap = await deps.decodificar(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new ErrorValidacion(
      `No se pudo leer «${archivo.name}». Prueba a exportarla como JPG desde Fotos.`,
    );
  }

  try {
    const { width, height } = bitmap;

    if ((width * height) / 1_000_000 > MAX_MEGAPIXELES) {
      // Un canvas de este tamaño falla en iOS sin decir por qué.
      throw new ErrorValidacion(
        `«${archivo.name}» es demasiado grande (${width}×${height}). Redúcela antes de subirla.`,
      );
    }

    if (planImagen(archivo, bitmap) === 'tal-cual') {
      return { blob: archivo, width, height };
    }

    const destino = escalarA(width, height, LADO_LARGO_FOTO);
    const canvas = deps.crearCanvas();
    canvas.width = destino.width;
    canvas.height = destino.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ErrorValidacion('Este navegador no puede procesar la foto.');
    ctx.drawImage(...([bitmap, 0, 0, destino.width, destino.height] as never[]));

    // q95, no 0.85: es el único encodeo que sufre la foto, y Cloudflare va a
    // re-comprimir encima al servirla.
    const blob = await new Promise<Blob>((ok, fallar) =>
      canvas.toBlob(
        (b) => (b ? ok(b) : fallar(new ErrorValidacion('No se pudo procesar la foto.'))),
        'image/jpeg',
        0.95,
      ),
    );

    if (blob.type !== 'image/jpeg') {
      throw new ErrorValidacion(`Este navegador no pudo convertir «${archivo.name}».`);
    }

    return { blob, ...destino };
  } finally {
    // Decenas de megas por foto: sin esto, ocho fotos seguidas tumban la pestaña.
    bitmap.close?.();
  }
}
