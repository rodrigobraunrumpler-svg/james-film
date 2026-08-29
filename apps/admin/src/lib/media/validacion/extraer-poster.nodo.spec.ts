import { describe, expect, it, vi } from 'vitest';
import { extraerPoster } from './extraer-poster';
import type { CanvasFalso, DepsPoster, VideoLike } from './extraer-poster';

const archivo = () => new File([new Uint8Array(1024)], 'reel.mp4', { type: 'video/mp4' });

/**
 * Un `<video>` de mentira que emite los eventos en el orden que decide el test.
 * happy-dom no decodifica vídeo: `loadedmetadata` no dispara y `duration` es
 * NaN, así que un test "de verdad" ahí pasaría sin comprobar nada.
 */
function videoFalso(over: Partial<VideoLike> = {}) {
  const oyentes = new Map<string, (() => void)[]>();
  const registro: string[] = [];
  let currentTime = 0;

  const video = {
    muted: false,
    playsInline: false,
    preload: '',
    src: '',
    duration: 40,
    videoWidth: 1080,
    videoHeight: 1920,
    get currentTime() {
      return currentTime;
    },
    set currentTime(v: number) {
      currentTime = v;
      registro.push(`seek:${v}`);
    },
    addEventListener(tipo: string, cb: () => void) {
      oyentes.set(tipo, [...(oyentes.get(tipo) ?? []), cb]);
    },
    removeAttribute(nombre: string) {
      registro.push(`removeAttribute:${nombre}`);
    },
    load() {
      registro.push('load');
    },
    ...over,
  } as VideoLike & { currentTime: number };

  const emitir = (tipo: string) => {
    registro.push(`evento:${tipo}`);
    for (const cb of oyentes.get(tipo) ?? []) cb();
  };

  return { video, emitir, registro, oyentes };
}

function canvasFalso(tipoBlob = 'image/jpeg'): CanvasFalso {
  const dibujos: unknown[][] = [];
  return {
    width: 0,
    height: 0,
    dibujos,
    getContext: () => ({ drawImage: (...args: unknown[]) => dibujos.push(args) }),
    toBlob: (cb, tipo) =>
      // El navegador responde de forma asíncrona; hacerlo síncrono aquí
      // escondería un fallo de orden que en Safari sí ocurriría.
      queueMicrotask(() => cb(new Blob([new Uint8Array(10)], { type: tipoBlob || tipo }))),
  };
}

function montar(over: Partial<DepsPoster> = {}, videoOver: Partial<VideoLike> = {}) {
  const falso = videoFalso(videoOver);
  const canvas = canvasFalso();
  const revocarUrl = vi.fn();

  const deps: DepsPoster = {
    crearVideo: () => falso.video,
    crearCanvas: () => canvas,
    crearUrl: () => 'blob:falsa',
    revocarUrl,
    timeoutMs: 50,
    ...over,
  };

  return { ...falso, canvas, revocarUrl, deps };
}

/** Deja correr la cola de microtareas para que los oyentes queden registrados. */
const respirar = () => new Promise((r) => setTimeout(r, 0));

describe('extraerPoster', () => {
  it('saca el frame del medio, no el primero (que suele ser negro)', async () => {
    const m = montar();
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    m.emitir('loadedmetadata');
    await respirar();
    m.emitir('seeked');

    await promesa;
    expect(m.registro).toContain('seek:20');
  });

  it('el seek va DESPUÉS de loadedmetadata, nunca antes', async () => {
    // Antes de loadedmetadata, `duration` es NaN: el seek iría a NaN y el
    // evento `seeked` no llegaría nunca.
    const m = montar();
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    m.emitir('loadedmetadata');
    await respirar();
    m.emitir('seeked');
    await promesa;

    expect(m.registro.indexOf('evento:loadedmetadata')).toBeLessThan(
      m.registro.findIndex((r) => r.startsWith('seek:')),
    );
  });

  it('devuelve width, height y duración junto al poster', async () => {
    const m = montar();
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    m.emitir('loadedmetadata');
    await respirar();
    m.emitir('seeked');

    const resultado = await promesa;
    expect(resultado).toMatchObject({ width: 1080, height: 1920, durationSec: 40 });
    expect(resultado.poster.type).toBe('image/jpeg');
  });

  it('la duración va redondeada a entero: Media.durationSec es Int', async () => {
    const m = montar({}, { duration: 30.7 } as Partial<VideoLike>);
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    m.emitir('loadedmetadata');
    await respirar();
    m.emitir('seeked');

    expect((await promesa).durationSec).toBe(31);
  });

  it('el vídeo va muted y playsInline: sin eso iOS no carga metadatos', async () => {
    const m = montar();
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    expect(m.video.muted).toBe(true);
    expect(m.video.playsInline).toBe(true);

    m.emitir('loadedmetadata');
    await respirar();
    m.emitir('seeked');
    await promesa;
  });

  it('un error del vídeo da mensaje accionable, no "formato inválido"', async () => {
    const m = montar();
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    m.emitir('error');

    await expect(promesa).rejects.toThrow(/CapCut/);
  });

  it('libera la URL y el decodificador TAMBIÉN en la rama de error', async () => {
    // El snippet de §10 solo revoca en el camino feliz: cada archivo rechazado
    // dejaría un decodificador vivo, y en el iPhone eso son ocho.
    const m = montar();
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    m.emitir('error');
    await expect(promesa).rejects.toThrow();

    expect(m.revocarUrl).toHaveBeenCalledWith('blob:falsa');
    expect(m.registro).toContain('removeAttribute:src');
    // revokeObjectURL solo NO basta: sin load() el decodificador sigue ocupado.
    expect(m.registro).toContain('load');
  });

  it('si iOS no dispara ni loadedmetadata ni error, corta por timeout', async () => {
    // Sin esto el archivo se queda en VALIDANDO para siempre, un estado que la
    // máquina no contempla. Un archivo colgado es peor que uno rechazado.
    const m = montar({ timeoutMs: 20 });
    const promesa = extraerPoster(archivo(), m.deps);

    await expect(promesa).rejects.toThrow(/CapCut/);
    expect(m.revocarUrl).toHaveBeenCalled();
  });

  it('si el navegador cae a PNG, lo dice en vez de subir un poster roto', async () => {
    // `canvas.toBlob('image/webp')` no existe en Safari y la spec obliga a caer
    // a PNG SIN lanzar error. Se asevera el tipo, no se supone.
    const m = montar({ crearCanvas: () => canvasFalso('image/png') });
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    m.emitir('loadedmetadata');
    await respirar();
    m.emitir('seeked');

    await expect(promesa).rejects.toThrow(/poster/i);
  });

  it('un vídeo sin dimensiones se rechaza antes de dibujar nada', async () => {
    const m = montar({}, { videoWidth: 0, videoHeight: 0 } as Partial<VideoLike>);
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    m.emitir('loadedmetadata');

    await expect(promesa).rejects.toThrow(/CapCut/);
  });

  it('el canvas toma el tamaño real del vídeo', async () => {
    const m = montar();
    const promesa = extraerPoster(archivo(), m.deps);

    await respirar();
    m.emitir('loadedmetadata');
    await respirar();
    m.emitir('seeked');
    await promesa;

    expect(m.canvas.width).toBe(1080);
    expect(m.canvas.height).toBe(1920);
    expect(m.canvas.dibujos).toHaveLength(1);
  });
});
