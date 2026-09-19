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
  recodificar: (a) => Promise.resolve(a),
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

  it('un HEVC ya NO se rechaza: se convierte y se sube lo convertido', async () => {
    // El iPhone de James graba HEVC salvo que alguien se acuerde de un ajuste,
    // y acordarse no es una solución. Antes esto devolvía `ok: false`.
    const convertido = new File([new Uint8Array(4)], 'reel.mp4', { type: 'video/mp4' });
    const recodificar = vi.fn().mockResolvedValue(convertido);

    const resultado = await prepararArchivo(
      conTamano(video({ name: 'IMG_1.MOV', type: 'video/quicktime' }), 1000),
      'REEL',
      deps({
        inspeccionar: () => Promise.resolve({ faststart: true, codec: 'hevc' }),
        recodificar,
      }),
    );

    expect(recodificar).toHaveBeenCalledOnce();
    expect(resultado.ok).toBe(true);
    // Lo que viaja al presign es `blob`, y de ahí sale el content-type: si
    // siguiera siendo el original, R2 recibiría un .MOV con HEVC dentro.
    if (resultado.ok) expect(resultado.blob).toBe(convertido);
  });

  it('el poster se saca del CONVERTIDO, no del original', async () => {
    // El original está en HEVC: en un Chrome sin decodificador por hardware,
    // pedirle un fotograma a un `<video>` no devuelve nada.
    const convertido = new File([new Uint8Array(4)], 'reel.mp4', { type: 'video/mp4' });
    const extraerPoster = vi.fn().mockResolvedValue({
      poster: new Blob([new Uint8Array(4)], { type: 'image/jpeg' }),
      width: 1080,
      height: 1920,
      durationSec: 30,
    });

    await prepararArchivo(
      conTamano(video(), 1000),
      'REEL',
      deps({
        inspeccionar: () => Promise.resolve({ faststart: true, codec: 'hevc' }),
        recodificar: () => Promise.resolve(convertido),
        extraerPoster,
      }),
    );

    expect(extraerPoster).toHaveBeenCalledWith(convertido);
  });

  it('un 4K en H.264 también se convierte, y solo UNA vez', async () => {
    // Este no se ve en la cabecera: hace falta leer los metadatos. Y el vídeo
    // de James venía en 3840x2160 con el códec correcto, así que sin esta
    // segunda oportunidad se rechazaría igual.
    const convertido = new File([new Uint8Array(4)], 'reel.mp4', { type: 'video/mp4' });
    const recodificar = vi.fn().mockResolvedValue(convertido);
    const medidas = [
      { width: 3840, height: 2160, durationSec: 30 },
      { width: 1920, height: 1080, durationSec: 30 },
    ];
    const extraerPoster = vi.fn().mockImplementation(() =>
      Promise.resolve({
        poster: new Blob([new Uint8Array(4)], { type: 'image/jpeg' }),
        ...(medidas.shift() ?? { width: 1920, height: 1080, durationSec: 30 }),
      }),
    );

    const resultado = await prepararArchivo(
      conTamano(video(), 1000),
      'REEL',
      deps({ recodificar, extraerPoster }),
    );

    expect(recodificar).toHaveBeenCalledOnce();
    expect(resultado.ok).toBe(true);
  });

  it('si el convertido SIGUE sin caber, se rechaza en vez de subirlo', async () => {
    // Convertir no es una promesa de que quepa. Sin esta comprobación se
    // subirían 200 MB para que la web los rechazara al otro lado.
    const recodificar = vi
      .fn()
      .mockResolvedValue(new File([new Uint8Array(4)], 'reel.mp4', { type: 'video/mp4' }));

    const resultado = await prepararArchivo(
      conTamano(video(), 1000),
      'REEL',
      deps({
        recodificar,
        extraerPoster: () =>
          Promise.resolve({
            poster: new Blob([new Uint8Array(4)], { type: 'image/jpeg' }),
            width: 3840,
            height: 2160,
            durationSec: 30,
          }),
      }),
    );

    expect(recodificar).toHaveBeenCalledOnce();
    expect(resultado.ok).toBe(false);
  });

  it('un archivo que YA sirve no convierte nada', async () => {
    // La librería va con import dinámico: si esto se llamara de más, cada
    // subida buena se descargaría un megabyte de codificador para nada.
    const recodificar = vi.fn();

    const resultado = await prepararArchivo(conTamano(video(), 1000), 'REEL', deps({ recodificar }));

    expect(recodificar).not.toHaveBeenCalled();
    expect(resultado.ok).toBe(true);
  });

  it('avisa de la etapa y del progreso mientras convierte', async () => {
    // Sin esto la tesela se queda en «Comprobando…» medio minuto, y eso se lee
    // como que se colgó. El progreso es REAL, nunca indeterminado.
    const etapas: Array<[string, number | undefined]> = [];
    await prepararArchivo(
      conTamano(video(), 1000),
      'REEL',
      deps({
        inspeccionar: () => Promise.resolve({ faststart: true, codec: 'hevc' }),
        recodificar: (a, onProgreso) => {
          onProgreso(0.5);
          return Promise.resolve(a);
        },
      }),
      (etapa, fraccion) => etapas.push([etapa, fraccion]),
    );

    expect(etapas).toContainEqual(['RECODIFICANDO', 0]);
    expect(etapas).toContainEqual(['RECODIFICANDO', 0.5]);
    expect(etapas.at(-1)?.[0]).toBe('EXTRAYENDO_POSTER');
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
