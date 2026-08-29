import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { analizarCabecera } from './faststart';
import { CABECERA_BYTES } from './limites';

/**
 * El parser contra MP4 REALES de ffmpeg, no contra cajas que fabrica el propio
 * test: una cabecera inventada demuestra que el parser lee lo que el test
 * escribe, no lo que produce un codificador de verdad.
 *
 * Son los mismos ficheros que sube el E2E, con el preset de entrega de §4.
 */
const leer = async (nombre: string): Promise<ArrayBuffer> => {
  const ruta = new URL(`../../../../e2e/fixtures/${nombre}`, import.meta.url);
  const buffer = await readFile(ruta);
  const trozo = buffer.subarray(0, CABECERA_BYTES);
  return trozo.buffer.slice(trozo.byteOffset, trozo.byteOffset + trozo.byteLength) as ArrayBuffer;
};

describe('analizarCabecera contra MP4 de verdad', () => {
  it('un H.264 con +faststart pasa', async () => {
    expect(analizarCabecera(await leer('reel.mp4'))).toEqual({ faststart: true, codec: 'h264' });
  });

  it('un HEVC se reconoce aunque también traiga faststart', async () => {
    // Es el caso que importa: iOS lo reproduce, así que "el navegador puede
    // con él" no sirve de criterio.
    expect(analizarCabecera(await leer('reel-hevc.mp4'))).toEqual({
      faststart: true,
      codec: 'hevc',
    });
  });
});
