import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inspeccionarMp4, validarMp4 } from './faststart';

/** Igual que `faststart.fixtures.nodo.spec.ts`: contra el fichero REAL. */
const leer = (nombre: string) => {
  const bytes = readFileSync(new URL(`../../../../e2e/fixtures/${nombre}`, import.meta.url));
  return {
    size: bytes.byteLength,
    slice: (a: number, b: number) => ({
      arrayBuffer: () => Promise.resolve(bytes.buffer.slice(a, b)),
    }),
  };
};

const archivo = { name: 'reel-sin-faststart.mp4', size: 41820, type: 'video/mp4' };

describe('el fixture sin faststart', () => {
  it('el parser lo ve SIN faststart y en H.264', async () => {
    const cabecera = await inspeccionarMp4(leer('reel-sin-faststart.mp4'));
    expect(cabecera).toEqual({ faststart: false, codec: 'h264' });
  });

  it('y el original SÍ lo tiene: el fixture no es una copia', async () => {
    // Sin esta comparación, un script roto que copiara el fichero tal cual
    // pasaría el test de arriba solo si el original ya estuviera mal.
    expect(await inspeccionarMp4(leer('reel.mp4'))).toEqual({ faststart: true, codec: 'h264' });
  });

  it('avisa pero NO bloquea', async () => {
    const cabecera = await inspeccionarMp4(leer('reel-sin-faststart.mp4'));
    const { error, aviso } = validarMp4(archivo, cabecera);

    expect(error).toBeNull();
    expect(aviso).toMatch(/inicio rápido|optimizar para web/);
  });
});
