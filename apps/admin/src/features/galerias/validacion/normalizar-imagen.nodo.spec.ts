import { describe, expect, it, vi } from 'vitest';
import type { CanvasFalso } from './extraer-poster';
import { normalizarImagen, planImagen } from './normalizar-imagen';
import type { DepsImagen } from './normalizar-imagen';

const foto = (name = 'foto.jpg', type = 'image/jpeg') =>
  new File([new Uint8Array(16)], name, { type });

const canvasFalso = (tipoBlob = 'image/jpeg'): CanvasFalso => {
  const dibujos: unknown[][] = [];
  return {
    width: 0,
    height: 0,
    dibujos,
    getContext: () => ({ drawImage: (...args: unknown[]) => dibujos.push(args) }),
    toBlob: (cb) => queueMicrotask(() => cb(new Blob([new Uint8Array(8)], { type: tipoBlob }))),
  };
};

function montar(dim = { width: 1200, height: 1600 }, canvas = canvasFalso()) {
  const cerrar = vi.fn();
  const decodificar = vi.fn(() => Promise.resolve({ ...dim, close: cerrar }));
  const deps: DepsImagen = { decodificar, crearCanvas: () => canvas };
  return { deps, decodificar, canvas, cerrar };
}

describe('planImagen', () => {
  it('un JPEG de 1200x1600 no se toca', () => {
    expect(planImagen({ type: 'image/jpeg' }, { width: 1200, height: 1600 })).toBe('tal-cual');
  });

  it('un HEIC siempre se convierte: Cloudflare no lo procesa', () => {
    expect(planImagen({ type: 'image/heic' }, { width: 800, height: 600 })).toBe('convertir');
  });

  it('por encima de 2560 de lado largo se redimensiona', () => {
    expect(planImagen({ type: 'image/jpeg' }, { width: 4000, height: 3000 })).toBe('convertir');
  });

  it('mide el lado LARGO: una foto vertical enorme también entra', () => {
    expect(planImagen({ type: 'image/jpeg' }, { width: 2000, height: 4000 })).toBe('convertir');
  });

  it('un PNG que ya cumple se deja: re-encodearlo a JPEG le quitaría la transparencia', () => {
    expect(planImagen({ type: 'image/png' }, { width: 1000, height: 1000 })).toBe('tal-cual');
  });

  it('justo en 2560 no se toca; en 2561 sí', () => {
    expect(planImagen({ type: 'image/jpeg' }, { width: 2560, height: 1000 })).toBe('tal-cual');
    expect(planImagen({ type: 'image/jpeg' }, { width: 2561, height: 1000 })).toBe('convertir');
  });
});

describe('normalizarImagen', () => {
  it('NO re-encodea un JPEG que ya cumple: comprimir dos veces degrada', async () => {
    const original = foto();
    const m = montar({ width: 1200, height: 1600 });

    const resultado = await normalizarImagen(original, m.deps);

    expect(resultado.blob).toBe(original);
    expect(resultado).toMatchObject({ width: 1200, height: 1600 });
    expect(m.canvas.dibujos).toHaveLength(0);
  });

  it('convierte HEIC a JPEG aunque no haga falta redimensionar', async () => {
    const m = montar({ width: 800, height: 600 });

    const resultado = await normalizarImagen(foto('IMG_1.HEIC', 'image/heic'), m.deps);

    expect(resultado.blob.type).toBe('image/jpeg');
    expect(m.canvas.dibujos).toHaveLength(1);
  });

  it('redimensiona a 2560px de lado largo conservando la proporción', async () => {
    const m = montar({ width: 4000, height: 3000 });

    const resultado = await normalizarImagen(foto(), m.deps);

    expect(resultado).toMatchObject({ width: 2560, height: 1920 });
    expect(m.canvas.width).toBe(2560);
    expect(m.canvas.height).toBe(1920);
  });

  it('respeta la orientación EXIF: una foto vertical no sale girada', async () => {
    // Es el decodificador quien aplica el EXIF, y solo si se le pide.
    const m = montar();

    await normalizarImagen(foto('IMG_1.HEIC', 'image/heic'), m.deps);

    expect(m.decodificar).toHaveBeenCalledWith(expect.anything(), {
      imageOrientation: 'from-image',
    });
  });

  it('libera el bitmap: en el iPhone son decenas de megas por foto', async () => {
    const m = montar({ width: 4000, height: 3000 });

    await normalizarImagen(foto(), m.deps);

    expect(m.cerrar).toHaveBeenCalled();
  });

  it('lo libera TAMBIÉN si el dibujo falla', async () => {
    const canvas = { ...canvasFalso(), getContext: () => null };
    const m = montar({ width: 4000, height: 3000 }, canvas as CanvasFalso);

    await expect(normalizarImagen(foto(), m.deps)).rejects.toThrow();
    expect(m.cerrar).toHaveBeenCalled();
  });

  it('rechaza por encima de 100 MP antes de intentar dibujarla', async () => {
    // Un canvas así falla en iOS sin decir por qué: se rechaza con un motivo.
    const m = montar({ width: 12_000, height: 10_000 });

    await expect(normalizarImagen(foto(), m.deps)).rejects.toThrow(/grande/i);
  });

  it('un archivo que el navegador no sabe decodificar da mensaje accionable', async () => {
    const m = montar();
    m.deps.decodificar = () => Promise.reject(new Error('decode error'));

    await expect(normalizarImagen(foto(), m.deps)).rejects.toThrow(/JPG/);
  });

  it('si el navegador no da JPEG, lo dice en vez de subir algo que no cuadra', async () => {
    const m = montar({ width: 4000, height: 3000 }, canvasFalso('image/png'));

    await expect(normalizarImagen(foto(), m.deps)).rejects.toThrow(/no pudo/i);
  });
});
