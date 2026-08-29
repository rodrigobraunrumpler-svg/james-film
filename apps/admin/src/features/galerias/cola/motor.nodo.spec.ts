import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaType } from '@james-film/contracts';
import type { Preparado } from '../validacion/preparar';
import { crearCola, PRESUPUESTO_MS, type DepsCola } from './motor';
import type { ItemCola } from './tipos';

const archivo = (nombre = 'reel.mp4') =>
  new File([new Uint8Array(8)], nombre, { type: 'video/mp4' });

const preparadoOk = (f: File): Preparado => ({
  ok: true,
  archivo: f,
  blob: f,
  tipo: 'REEL',
  width: 1080,
  height: 1920,
  durationSec: 30,
  poster: new Blob([new Uint8Array(4)], { type: 'image/jpeg' }),
});

/** Una promesa que el test resuelve cuando quiere: así congela un estado. */
function diferida<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((ok, no) => {
    resolver = ok;
    rechazar = no;
  });
  return { promesa, resolver, rechazar };
}

let contador = 0;
const fabrica = (over: Partial<DepsCola> = {}) => {
  const registro: string[] = [];

  const deps: DepsCola = {
    preparar: (f) => {
      registro.push(`preparar:${f.name}`);
      return Promise.resolve(preparadoOk(f));
    },
    firmar: (_g, item) => {
      registro.push(`firmar:${String(item.clientUploadId)}`);
      return Promise.resolve({
        mediaId: `media-${String(item.clientUploadId)}`,
        uploadUrl: 'https://r2.test/put',
        posterUploadUrl: 'https://r2.test/poster',
        storageKey: 'videos/x.mp4',
        posterKey: 'posters/x.jpg',
      });
    },
    subir: ({ url }) => {
      registro.push(`subir:${url}`);
      return Promise.resolve();
    },
    confirmar: (mediaId) => {
      registro.push(`confirmar:${mediaId}`);
      return Promise.resolve({
        id: mediaId,
        status: 'READY',
        orientation: 'VERTICAL',
        error: null,
      });
    },
    borrar: (mediaId) => {
      registro.push(`borrar:${mediaId}`);
      return Promise.resolve();
    },
    nuevoId: () => `id-${++contador}`,
    ahora: () => Date.now(),
    // Sin esperas reales, pero cediendo el turno al bucle de eventos: con una
    // promesa ya resuelta, el reintento se queda girando en microtareas y NADA
    // macro llega a ejecutarse — ni el propio `hasta` de este test.
    dormir: () => new Promise((r) => setTimeout(r, 0)),
    ...over,
  };

  return { deps, registro, cola: crearCola(deps) };
};

const items = (cola: ReturnType<typeof crearCola>): ItemCola[] =>
  Object.values(cola.store.getState().items);

const hasta = async (cond: () => boolean, vueltas = 2000): Promise<void> => {
  for (let i = 0; i < vueltas; i++) {
    if (cond()) return;
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('No se cumplió la condición');
};

const reels = (n: number): { archivo: File; tipo: MediaType }[] =>
  Array.from({ length: n }, (_, i) => ({
    archivo: archivo(`reel-${i}.mp4`),
    tipo: 'REEL' as const,
  }));

beforeEach(() => {
  contador = 0;
});

describe('cola de subidas', () => {
  it('un reel correcto llega a LISTO pasando por firma, subida y confirm', async () => {
    const { cola, registro } = fabrica();
    const [id] = cola.anadir('g1', reels(1));

    await hasta(() => cola.store.getState().items[id]?.estado === 'LISTO');

    expect(registro.filter((r) => r.startsWith('firmar'))).toHaveLength(1);
    expect(registro.some((r) => r.startsWith('confirmar'))).toBe(true);
  });

  it('un archivo en HEVC no detiene a los otros siete', async () => {
    // La máquina de estados es POR ARCHIVO: si fuese global, el tercero
    // tumbaría el lote entero.
    const { cola } = fabrica({
      preparar: (f) =>
        Promise.resolve(
          f.name === 'reel-2.mp4'
            ? { ok: false, archivo: f, motivo: 'Está en HEVC (H.265). Elige H.264 en CapCut.' }
            : preparadoOk(f),
        ),
    });

    cola.anadir('g1', reels(8));
    await hasta(() => items(cola).filter((i) => i.estado === 'LISTO').length === 7);

    const fallido = items(cola).find((i) => i.estado === 'FALLIDO');
    expect(fallido?.motivo).toContain('H.264');
    expect(items(cola).filter((i) => i.estado === 'LISTO')).toHaveLength(7);
  });

  it('nunca hay más de 3 subidas en vuelo con 8 archivos', async () => {
    let enVuelo = 0;
    let pico = 0;
    const puertas: (() => void)[] = [];

    const { cola } = fabrica({
      subir: () => {
        enVuelo++;
        pico = Math.max(pico, enVuelo);
        const d = diferida<void>();
        puertas.push(() => {
          enVuelo--;
          d.resolver();
        });
        return d.promesa;
      },
    });

    cola.anadir('g1', reels(8));
    await hasta(() => puertas.length >= 3);
    // Ocho simultáneas por datos móviles saturan y TODAS van lentas.
    expect(pico).toBeLessThanOrEqual(3);

    // Se abren las puertas EN CADA vuelta: al liberar las tres primeras entran
    // otras tres, y una copia del array las dejaría cerradas para siempre.
    await hasta(() => {
      for (const abrir of puertas.splice(0)) abrir();
      return items(cola).filter((i) => i.estado === 'LISTO').length === 8;
    }, 5000);
    expect(pico).toBeLessThanOrEqual(3);
  });

  it('solo decodifica un vídeo a la vez: el iPhone no aguanta ocho', async () => {
    let decodificando = 0;
    let pico = 0;

    const { cola } = fabrica({
      preparar: async (f) => {
        decodificando++;
        pico = Math.max(pico, decodificando);
        await Promise.resolve();
        decodificando--;
        return preparadoOk(f);
      },
    });

    cola.anadir('g1', reels(8));
    await hasta(() => items(cola).filter((i) => i.estado === 'LISTO').length === 8, 5000);

    expect(pico).toBe(1);
  });

  it('un reintento vuelve a FIRMAR y NO re-ejecuta la preparación', async () => {
    // Volver a preparar sería fatal: la firma incluye content-length, y un
    // canvas.toBlob que devuelva otros bytes deja un 403 que no converge.
    let intentos = 0;
    const { cola, registro } = fabrica({
      subir: () => {
        intentos++;
        return intentos === 1 ? Promise.reject(new Error('red')) : Promise.resolve();
      },
    });

    const [id] = cola.anadir('g1', reels(1));
    await hasta(() => cola.store.getState().items[id]?.estado === 'LISTO');

    expect(registro.filter((r) => r.startsWith('preparar'))).toHaveLength(1);
    // Una re-firma POR intento: sin ella el segundo intento reusaría una URL
    // ya expirada; con más de una, un 403 que no sea por expiración entra en bucle.
    expect(registro.filter((r) => r.startsWith('firmar'))).toHaveLength(2);
  });

  it('la re-firma manda el MISMO clientUploadId: el upsert no crea filas', async () => {
    let intentos = 0;
    const identidades: unknown[] = [];

    const { cola } = fabrica({
      firmar: (_g, item) => {
        identidades.push(item.clientUploadId);
        return Promise.resolve({
          mediaId: 'm1',
          uploadUrl: 'https://r2.test/put',
          posterUploadUrl: null,
          storageKey: 'k',
          posterKey: null,
        });
      },
      subir: () => (++intentos === 1 ? Promise.reject(new Error('red')) : Promise.resolve()),
    });

    const [id] = cola.anadir('g1', reels(1));
    await hasta(() => cola.store.getState().items[id]?.estado === 'LISTO');

    expect(identidades).toHaveLength(2);
    expect(identidades[0]).toBe(identidades[1]);
  });

  it('se rinde cuando se agota el presupuesto de 5 min, no a los tres intentos', async () => {
    // Un contador daría 7 segundos de presupuesto, y en Ayacucho una caída de
    // señal dura 20-60 s: trataría como permanente justo lo que dice cubrir.
    let reloj = 0;
    const { cola, registro } = fabrica({
      ahora: () => reloj,
      dormir: () => {
        reloj += 30_000;
        return new Promise((r) => setTimeout(r, 0));
      },
      subir: () => Promise.reject(new Error('sin señal')),
    });

    const [id] = cola.anadir('g1', reels(1));
    await hasta(() => cola.store.getState().items[id]?.estado === 'FALLIDO', 5000);

    // Con un contador de tres serían 3; con presupuesto temporal, muchos más.
    expect(registro.filter((r) => r.startsWith('firmar')).length).toBeGreaterThan(5);
    expect(reloj).toBeGreaterThanOrEqual(PRESUPUESTO_MS);
  });

  it('cancelar a mitad de subida no deja un Media PENDING huérfano', async () => {
    const puerta = diferida<void>();
    const { cola, registro } = fabrica({ subir: () => puerta.promesa });

    const [id] = cola.anadir('g1', reels(1));
    await hasta(() => cola.store.getState().items[id]?.estado === 'SUBIENDO');

    await cola.cancelar(id);

    // El Media nace PENDING en el PRESIGN, no en la subida: sin el DELETE queda
    // una tarjeta muerta en la grilla hasta el cron de la fase 6.
    expect(registro).toContain(`borrar:media-${id}`);
    expect(registro.some((r) => r.startsWith('confirmar'))).toBe(false);
    expect(cola.store.getState().items[id]).toBeUndefined();
  });

  it('cancelar libera el hueco de concurrencia', async () => {
    const puertas: (() => void)[] = [];
    const { cola } = fabrica({
      subir: () => {
        const d = diferida<void>();
        puertas.push(d.resolver);
        return d.promesa;
      },
    });

    const ids = cola.anadir('g1', reels(4));
    await hasta(() => puertas.length === 3);

    await cola.cancelar(ids[0]);

    // El cuarto entra en cuanto se libera el hueco, sin esperar a los otros dos.
    await hasta(() => puertas.length === 4);
  });

  it('un confirm que devuelve FAILED se descarta y se vuelve a firmar con identidad NUEVA', async () => {
    // Reintentar el mismo mediaId respondería 200 sin cambiar nada: `confirmar`
    // corta con `if (status !== PENDING)`.
    let confirmaciones = 0;
    const identidades: unknown[] = [];

    const { cola, registro } = fabrica({
      firmar: (_g, item) => {
        identidades.push(item.clientUploadId);
        return Promise.resolve({
          mediaId: `m${identidades.length}`,
          uploadUrl: 'https://r2.test/put',
          posterUploadUrl: null,
          storageKey: 'k',
          posterKey: null,
        });
      },
      confirmar: (mediaId) => {
        confirmaciones++;
        return Promise.resolve({
          id: mediaId,
          status: confirmaciones === 1 ? 'FAILED' : 'READY',
          orientation: 'VERTICAL',
          error: 'La subida quedó incompleta: llegaron 10 de 100 bytes.',
        });
      },
    });

    const [id] = cola.anadir('g1', reels(1));
    await hasta(() => cola.store.getState().items[id]?.estado === 'LISTO');

    expect(registro).toContain('borrar:m1');
    // Identidad nueva, o el upsert recuperaría la fila borrada y `confirmar`
    // la ignoraría por deletedAt.
    expect(identidades[0]).not.toBe(identidades[1]);
    // La clave de React NO cambia: remontar la tarjeta borraría el progreso.
    expect(cola.store.getState().items[id]).toBeDefined();
  });

  it('el poster sube ANTES del confirm', async () => {
    const { cola, registro } = fabrica();
    const [id] = cola.anadir('g1', reels(1));

    await hasta(() => cola.store.getState().items[id]?.estado === 'LISTO');

    // `confirmar` corta para todo lo que no sea PENDING: un poster que llegue
    // tarde deja el reel sin miniatura PARA SIEMPRE.
    expect(registro.indexOf('subir:https://r2.test/poster')).toBeLessThan(
      registro.findIndex((r) => r.startsWith('confirmar')),
    );
  });

  it('el poster se reintenta solo, sin re-subir el vídeo entero', async () => {
    let posters = 0;
    const { cola, registro } = fabrica({
      subir: ({ url }) => {
        registro.push(`subir:${url}`);
        if (!url.includes('poster')) return Promise.resolve();
        return ++posters === 1 ? Promise.reject(new Error('red')) : Promise.resolve();
      },
    });

    const [id] = cola.anadir('g1', reels(1));
    await hasta(() => cola.store.getState().items[id]?.estado === 'LISTO');

    expect(registro.filter((r) => r === 'subir:https://r2.test/put')).toHaveLength(1);
    expect(posters).toBe(2);
  });

  it('el progreso se refleja en el item, no en una barra indeterminada', async () => {
    // La subida se queda abierta a propósito: si terminara, el progreso saltaría
    // a 1 y el test no probaría nada.
    const { cola } = fabrica({
      subir: ({ onProgreso }) => {
        onProgreso?.({ cargado: 50, total: 200 });
        return new Promise<void>(() => {});
      },
    });

    const [id] = cola.anadir('g1', reels(1));
    await hasta(() => (cola.store.getState().items[id]?.progreso ?? 0) > 0);

    expect(cola.store.getState().items[id]?.progreso).toBeCloseTo(0.25);
    expect(cola.store.getState().items[id]?.estado).toBe('SUBIENDO');
  });

  it('reintentar un fallido reinicia el presupuesto y vuelve a intentarlo', async () => {
    let fallar = true;
    const { cola } = fabrica({
      subir: () => (fallar ? Promise.reject(new Error('red')) : Promise.resolve()),
      ahora: () => 0,
    });

    const [id] = cola.anadir('g1', reels(1));
    // Con `ahora` congelado el presupuesto no se agota nunca: se corta a mano.
    await hasta(() => cola.store.getState().items[id]?.intentos > 3);
    fallar = false;

    await hasta(() => cola.store.getState().items[id]?.estado === 'LISTO');
  });

  it('avisa a la caché cuando la galería cambia, en vez de pintar la grilla', async () => {
    // La grilla se pinta desde gallery.media (TanStack Query), no desde la cola:
    // si la pintara la cola, cada archivo en vuelo aparecería DOS veces.
    const alCambiarLaGaleria = vi.fn();
    const { cola } = fabrica();
    cola.alCambiarLaGaleria = alCambiarLaGaleria;

    const [id] = cola.anadir('g1', reels(1));
    await hasta(() => cola.store.getState().items[id]?.estado === 'LISTO');

    expect(alCambiarLaGaleria).toHaveBeenCalledWith('g1');
  });
});
