import { describe, expect, it, vi } from 'vitest';
import { prepararArchivo } from './preparar';
import type { DepsPreparar } from './preparar';

const video = (over: { name?: string; type?: string; size?: number } = {}) =>
  new File([new Uint8Array(8)], over.name ?? 'reel.mp4', { type: over.type ?? 'video/mp4' });

/** `File.size` es de solo lectura: se define encima para no materializar 300 MB. */
const conTamano = (f: File, size: number) => {
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

const deps = (over: Partial<DepsPreparar> = {}): DepsPreparar => ({
  inspeccionar: () => Promise.resolve({ faststart: true, codec: 'h264' }),
  extraerPoster: () =>
    Promise.resolve({
      poster: new Blob([new Uint8Array(4)], { type: 'image/jpeg' }),
      width: 1080,
      height: 1920,
      durationSec: 30,
    }),
  normalizarImagen: (a) => Promise.resolve({ blob: a, width: 1200, height: 1600 }),
  ...over,
});

describe('prepararArchivo', () => {
  it('un reel correcto sale listo con poster y metadatos', async () => {
    const resultado = await prepararArchivo(conTamano(video(), 35 * 1024 * 1024), 'REEL', deps());

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado).toMatchObject({ tipo: 'REEL', width: 1080, height: 1920, durationSec: 30 });
    expect(resultado.poster?.type).toBe('image/jpeg');
  });

  it('lo que no pasa NO entra en el presign, y dice por qué', async () => {
    const grande = conTamano(video(), 300 * 1024 * 1024);

    const resultado = await prepararArchivo(grande, 'REEL', deps());

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toContain('200 MB');
  });

  it('no decodifica nada si el archivo ya se rechazó por tamaño', async () => {
    // Decodificar 300 MB en el iPhone para luego descartarlo es justo lo que
    // hay que evitar: la validación barata va primero.
    const extraerPoster = vi.fn();
    const inspeccionar = vi.fn();

    await prepararArchivo(
      conTamano(video(), 300 * 1024 * 1024),
      'REEL',
      deps({ extraerPoster, inspeccionar }),
    );

    expect(inspeccionar).not.toHaveBeenCalled();
    expect(extraerPoster).not.toHaveBeenCalled();
  });

  it('un HEVC se rechaza sin llegar a extraer el poster', async () => {
    const extraerPoster = vi.fn();
    const resultado = await prepararArchivo(
      conTamano(video(), 1000),
      'REEL',
      deps({
        inspeccionar: () => Promise.resolve({ faststart: true, codec: 'hevc' }),
        extraerPoster,
      }),
    );

    expect(resultado.ok).toBe(false);
    expect(extraerPoster).not.toHaveBeenCalled();
  });

  it('los metadatos también se validan: un 4K se rechaza tras leerlo', async () => {
    const resultado = await prepararArchivo(
      conTamano(video(), 1000),
      'AFTERMOVIE',
      deps({
        extraerPoster: () =>
          Promise.resolve({
            poster: new Blob([], { type: 'image/jpeg' }),
            width: 3840,
            height: 2160,
            durationSec: 60,
          }),
      }),
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toContain('1080p');
  });

  it('una foto no pasa por el lector de MP4', async () => {
    const inspeccionar = vi.fn();
    const foto = conTamano(
      new File([new Uint8Array(4)], 'f.jpg', { type: 'image/jpeg' }),
      2_000_000,
    );

    const resultado = await prepararArchivo(foto, 'PHOTO', deps({ inspeccionar }));

    expect(resultado.ok).toBe(true);
    expect(inspeccionar).not.toHaveBeenCalled();
    if (!resultado.ok) return;
    expect(resultado).toMatchObject({ tipo: 'PHOTO', width: 1200, height: 1600 });
    expect(resultado.poster).toBeUndefined();
  });

  it('un fallo al decodificar se convierte en motivo, no en excepción', async () => {
    // Quien llama es la cola de subidas: una excepción suelta le tumbaría el
    // lote entero en vez de marcar un archivo.
    const resultado = await prepararArchivo(
      conTamano(video(), 1000),
      'REEL',
      deps({ extraerPoster: () => Promise.reject(new Error('boom')) }),
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBeTruthy();
  });
});
