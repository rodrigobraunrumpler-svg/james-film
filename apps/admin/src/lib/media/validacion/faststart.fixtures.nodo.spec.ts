import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { analizarCabecera, inspeccionarMp4 } from './faststart';
import type { BlobLeible } from './faststart';
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

/** Un `BlobLeible` sobre el fichero, para ejercitar las DOS ventanas de verdad. */
const comoBlob = async (nombre: string): Promise<BlobLeible> => {
  const buffer = await readFile(new URL(`../../../../e2e/fixtures/${nombre}`, import.meta.url));
  return {
    size: buffer.length,
    slice: (inicio, fin) => ({
      arrayBuffer: () => {
        const t = buffer.subarray(inicio, fin);
        return Promise.resolve(
          t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength) as ArrayBuffer,
        );
      },
    }),
  };
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

  /**
   * Los `.mov` llevan marca `ftyp` **`qt  `** en vez de `isom`, que es
   * exactamente lo que trae la cámara del iPhone — comprobado contra un
   * `IMG_*.MOV` real: `hvc1`, 1080x1920, 30 fps.
   *
   * Sin estos dos casos, aceptar `video/quicktime` en `MIMES_VIDEO` sería un
   * salto de fe: el parser se escribió mirando MP4 y nada demostraba que
   * supiera recorrer un contenedor QuickTime.
   */
  it('lee un .MOV con H.264 dentro, pese a la marca qt', async () => {
    expect(analizarCabecera(await leer('reel.mov'))).toEqual({ faststart: true, codec: 'h264' });
  });

  it('lee un .MOV con HEVC dentro: es el caso real del iPhone de James', async () => {
    expect(analizarCabecera(await leer('reel-hevc.mov'))).toEqual({
      faststart: true,
      codec: 'hevc',
    });
  });
});

describe('inspeccionarMp4 cuando el moov está al FINAL', () => {
  /**
   * El caso que se escapaba, y salió de un `IMG_*.MOV` real: `ftyp → wide →
   * mdat` de 106 MB con el `moov` detrás. La ventana de entrada no ve ningún
   * FourCC, el códec sale `desconocido`, y como `validarMp4` solo bloquea lo
   * que reconoce, **un HEVC sin faststart se subía entero**.
   *
   * El fixture pesa 211 KB a propósito: por debajo de los 64 KB de la ventana
   * el archivo se lee completo de una vez y esta rama nunca se ejecutaría.
   */
  it('encuentra el HEVC leyendo la cola', async () => {
    expect(await inspeccionarMp4(await comoBlob('reel-hevc-sin-faststart.mov'))).toEqual({
      faststart: false,
      codec: 'hevc',
    });
  });

  it('con faststart NO se lee la cola: una ventana basta', async () => {
    const blob = await comoBlob('reel-hevc.mov');
    const lecturas: Array<[number, number]> = [];
    const espiado: BlobLeible = {
      size: blob.size,
      slice: (i, f) => {
        lecturas.push([i, f]);
        return blob.slice(i, f);
      },
    };

    expect(await inspeccionarMp4(espiado)).toEqual({ faststart: true, codec: 'hevc' });
    expect(lecturas).toEqual([[0, blob.size]]);
  });
});
