import { createStore, type StoreApi } from 'zustand/vanilla';
import type { MediaType, MediaConfirmResult, PresignItemResult } from '@james-film/contracts';
import type { Preparado } from '../validacion/preparar';
import { ErrorSubida } from './subir';
import { estaEnCurso, ocupaDecodificador, ocupaRed, type EstadoItem, type ItemCola } from './tipos';

/** Ocho simultáneas por datos móviles saturan y todas van lentas (§10). */
export const CONCURRENCIA = 3;
/** Un `<video>` decodificando a la vez: el resto es memoria del iPhone. */
export const CONCURRENCIA_DECODE = 1;

/**
 * Presupuesto TEMPORAL, no un contador. "Tres intentos" son 7 segundos, y en
 * Ayacucho una caída de señal dura 20-60 s: un contador trataría como
 * permanente justo la intermitencia que dice cubrir.
 */
export const PRESUPUESTO_MS = 5 * 60_000;
const ESPERAS_MS = [1000, 2000, 4000, 8000];
/** El poster son 50 KB: reintentarlo cinco veces es gratis. */
const INTENTOS_POSTER = 5;

export interface DepsCola {
  preparar(
    archivo: File,
    tipo: MediaType,
    onEtapa: (e: 'VALIDANDO' | 'EXTRAYENDO_POSTER') => void,
  ): Promise<Preparado>;
  firmar(galleryId: string, item: Record<string, unknown>): Promise<PresignItemResult>;
  subir(opciones: {
    url: string;
    cuerpo: Blob;
    contentType: string;
    onProgreso?: (p: { cargado: number; total: number }) => void;
    onArrancar?: (abortar: () => void) => void;
  }): Promise<void>;
  confirmar(mediaId: string): Promise<MediaConfirmResult>;
  borrar(mediaId: string): Promise<void>;
  nuevoId(): string;
  ahora(): number;
  dormir(ms: number): Promise<void>;
}

export interface EstadoCola {
  items: Record<string, ItemCola>;
}

export interface Cola {
  store: StoreApi<EstadoCola>;
  /**
   * Se cablea después de crear la cola: el QueryClient nace dentro de React
   * (useState en el proveedor) y el singleton de módulo no puede esperarlo.
   */
  alCambiarLaGaleria?: (galleryId: string) => void;
  anadir(galleryId: string, archivos: { archivo: File; tipo: MediaType }[]): string[];
  cancelar(clientUploadId: string): Promise<void>;
  reintentar(clientUploadId: string): void;
  descartar(clientUploadId: string): void;
  borrarMedio(mediaId: string, galleryId?: string): Promise<void>;
}

/**
 * La cola. Fuera de React a propósito: con Context, cada tick de progreso
 * re-renderiza a todos los consumidores, y son decenas por segundo.
 *
 * La máquina de estados es POR ARCHIVO, no global: si James suelta ocho reels y
 * el tercero está en HEVC, los otros siete siguen subiendo.
 */
export function crearCola(deps: DepsCola): Cola {
  const store = createStore<EstadoCola>(() => ({ items: {} }));
  /** Lo que no va al store: no se pinta y cambiar su referencia re-renderizaría. */
  const preparados = new Map<string, Extract<Preparado, { ok: true }>>();
  const abortos = new Map<string, () => void>();
  const cancelados = new Set<string>();

  const leer = (id: string): ItemCola | undefined => store.getState().items[id];

  const parchear = (id: string, cambios: Partial<ItemCola>): void => {
    store.setState((estado) => {
      const actual = estado.items[id];
      if (!actual) return estado;
      return { items: { ...estado.items, [id]: { ...actual, ...cambios } } };
    });
  };

  const quitar = (id: string): void => {
    preparados.delete(id);
    abortos.delete(id);
    store.setState((estado) => {
      const { [id]: _fuera, ...resto } = estado.items;
      return { items: resto };
    });
  };

  const fallar = (id: string, motivo: string): void => {
    parchear(id, { estado: 'FALLIDO', motivo });
    bombear();
  };

  // ------------------------------------------------------------------ bombas

  /**
   * Arranca lo que quepa. Se llama tras cada transición: así el hueco que deja
   * un item que termina lo ocupa el siguiente sin esperar a nada más.
   */
  function bombear(): void {
    const items = Object.values(store.getState().items);

    if (items.filter(ocupaDecodificador).length < CONCURRENCIA_DECODE) {
      const siguiente = items.find(
        (i) => i.estado === 'SELECCIONADO' && !preparados.has(i.clientUploadId),
      );
      if (siguiente) void preparar(siguiente.clientUploadId);
    }

    const huecos = CONCURRENCIA - items.filter(ocupaRed).length;
    if (huecos <= 0) return;

    // Los que ya están preparados y esperando red. `estado: 'FIRMANDO'` se
    // marca ANTES de await para que el siguiente bombeo no los cuente dos veces.
    const listos = items.filter(
      (i) => i.estado === 'SELECCIONADO' && preparados.has(i.clientUploadId),
    );
    for (const item of listos.slice(0, huecos)) void enviar(item.clientUploadId);
  }

  async function preparar(id: string): Promise<void> {
    parchear(id, { estado: 'VALIDANDO' });
    const item = leer(id);
    if (!item) return;

    const resultado = await deps.preparar(item.archivo, item.tipo, (etapa) => {
      if (leer(id)) parchear(id, { estado: etapa });
    });

    if (cancelados.has(id) || !leer(id)) return;

    if (!resultado.ok) {
      // Un archivo rechazado NO detiene a los demás: se marca y se sigue.
      fallar(id, resultado.motivo);
      return;
    }

    preparados.set(id, resultado);
    if (resultado.aviso) parchear(id, { aviso: resultado.aviso });
    // Vuelve a SELECCIONADO: es la cola de espera de red, y `bombear` decide
    // cuándo hay hueco. Sin este paso, ocho archivos preparados arrancarían
    // ocho subidas.
    parchear(id, { estado: 'SELECCIONADO' });
    bombear();
  }

  /** Firma → sube → poster → confirma, con re-firma en cada reintento. */
  async function enviar(id: string): Promise<void> {
    parchear(id, { estado: 'FIRMANDO' });

    while (true) {
      const item = leer(id);
      const preparado = preparados.get(id);
      if (!item || !preparado || cancelados.has(id)) return;

      try {
        await intentar(id, item, preparado);
        return;
      } catch (e) {
        if (cancelados.has(id) || !leer(id)) return;

        const vivo = leer(id);
        const agotado = deps.ahora() - (vivo?.empezoEn ?? 0) >= PRESUPUESTO_MS;
        if (agotado) {
          fallar(id, mensajeDe(e));
          return;
        }

        const intentos = (vivo?.intentos ?? 0) + 1;
        parchear(id, { intentos, estado: 'FIRMANDO', motivo: null });
        await deps.dormir(ESPERAS_MS[Math.min(intentos - 1, ESPERAS_MS.length - 1)]);
      }
    }
  }

  async function intentar(
    id: string,
    item: ItemCola,
    preparado: Extract<Preparado, { ok: true }>,
  ): Promise<void> {
    // Se RE-FIRMA en cada intento, siempre, y da igual por qué falló el
    // anterior: R2 puede devolver 403 sin cabeceras CORS y el navegador lo
    // entrega como error de red genérico, sin status legible. Cualquier remedio
    // que dependa de leer el 403 fallaría justo en el caso real.
    const firma = await deps.firmar(item.galleryId, {
      filename: item.archivo.name,
      mimeType: preparado.blob.type,
      sizeBytes: preparado.blob.size,
      type: item.tipo,
      clientUploadId: item.identidad,
      width: preparado.width,
      height: preparado.height,
      durationSec: preparado.durationSec,
      posterMimeType: preparado.poster?.type,
      posterSizeBytes: preparado.poster?.size,
    });

    parchear(id, { mediaId: firma.mediaId, estado: 'SUBIENDO' });

    await deps.subir({
      url: firma.uploadUrl,
      cuerpo: preparado.blob,
      contentType: preparado.blob.type,
      onProgreso: ({ cargado, total }) =>
        parchear(id, { progreso: total > 0 ? cargado / total : 0, bytesSubidos: cargado }),
      onArrancar: (abortar) => abortos.set(id, abortar),
    });

    // El poster resuelve ANTES del confirm: `confirmar` corta con
    // `if (status !== PENDING)`, así que uno que llegue tarde deja el reel sin
    // miniatura PARA SIEMPRE, y sin autoplay en la grilla la tarjeta queda negra.
    if (preparado.poster && firma.posterUploadUrl) {
      await subirPoster(firma.posterUploadUrl, preparado.poster);
    }

    parchear(id, { estado: 'CONFIRMANDO', progreso: 1 });
    const resultado = await deps.confirmar(firma.mediaId);

    if (resultado.status === 'FAILED') {
      // NO se reintenta el confirm: `confirmar` corta para todo lo que no sea
      // PENDING, así que repetirlo devolvería 200 sin cambiar nada. Se descarta
      // la fila y se vuelve a firmar con identidad NUEVA — con la vieja, el
      // upsert recuperaría la fila borrada.
      await deps.borrar(firma.mediaId).catch(() => {});
      // Identidad NUEVA para el presign, o el upsert recuperaría la fila que
      // se acaba de borrar y `confirmar` la ignoraría por `deletedAt`.
      // La clave del mapa NO cambia: es la key de React, y remontar la tarjeta
      // le borraría el progreso a la vista de James en mitad del reintento.
      parchear(id, { identidad: deps.nuevoId(), mediaId: null, progreso: 0, bytesSubidos: 0 });
      throw new ErrorSubida(resultado.error ?? 'La subida quedó incompleta.', 'estado');
    }

    parchear(id, { estado: 'LISTO', progreso: 1, motivo: null });
    abortos.delete(id);
    cola.alCambiarLaGaleria?.(item.galleryId);
    bombear();
  }

  /** Cinco intentos seguidos: son 50 KB y el coste de perderlo es permanente. */
  async function subirPoster(url: string, poster: Blob): Promise<void> {
    for (let intento = 1; ; intento++) {
      try {
        await deps.subir({ url, cuerpo: poster, contentType: poster.type });
        return;
      } catch (e) {
        if (intento >= INTENTOS_POSTER) throw e;
        await deps.dormir(ESPERAS_MS[Math.min(intento - 1, ESPERAS_MS.length - 1)]);
      }
    }
  }

  // ----------------------------------------------------------------- público

  function anadir(galleryId: string, archivos: { archivo: File; tipo: MediaType }[]): string[] {
    const nuevos = archivos.map(({ archivo, tipo }) => {
      const id = deps.nuevoId();
      return {
        clientUploadId: id,
        identidad: id,
        galleryId,
        archivo,
        tipo,
        estado: 'SELECCIONADO' as EstadoItem,
        progreso: 0,
        bytesSubidos: 0,
        mediaId: null,
        motivo: null,
        aviso: null,
        intentos: 0,
        empezoEn: deps.ahora(),
      };
    });

    store.setState((estado) => ({
      items: { ...estado.items, ...Object.fromEntries(nuevos.map((i) => [i.clientUploadId, i])) },
    }));
    bombear();
    return nuevos.map((i) => i.clientUploadId);
  }

  /**
   * El `Media` nace PENDING en el PRESIGN, no en la subida: un `abort()` a
   * secas dejaría una tarjeta muerta en la grilla hasta el cron de la fase 6.
   * Es también el botón de eliminar de cualquier tarjeta, esté subiendo o READY.
   */
  async function cancelar(id: string): Promise<void> {
    const item = leer(id);
    if (!item) return;

    cancelados.add(id);
    abortos.get(id)?.();

    const galleryId = item.galleryId;
    quitar(id);
    bombear();

    // Si el DELETE falla no se reintenta: el cron recoge los PENDING huérfanos.
    if (item.mediaId) await deps.borrar(item.mediaId).catch(() => {});
    cola.alCambiarLaGaleria?.(galleryId);
  }

  function reintentar(id: string): void {
    const item = leer(id);
    if (!item || item.estado !== 'FALLIDO') return;

    cancelados.delete(id);
    // El presupuesto se reinicia: es una decisión NUEVA de James, no la
    // continuación del intento que se agotó.
    parchear(id, { estado: 'SELECCIONADO', motivo: null, intentos: 0, empezoEn: deps.ahora() });
    bombear();
  }

  /**
   * Eliminar un medio que ya no está en la cola (READY o PENDING de otra
   * sesión). Es el mismo DELETE que usa cancelar: un solo camino para las tres
   * acciones que quitan una tarjeta.
   */
  async function borrarMedio(mediaId: string, galleryId?: string): Promise<void> {
    await deps.borrar(mediaId);
    if (galleryId) cola.alCambiarLaGaleria?.(galleryId);
  }

  function descartar(id: string): void {
    cancelados.add(id);
    quitar(id);
    bombear();
  }

  const cola: Cola = { store, anadir, cancelar, reintentar, descartar, borrarMedio };
  return cola;
}

const mensajeDe = (e: unknown): string =>
  e instanceof Error ? e.message : 'No se pudo subir el archivo. Inténtalo otra vez.';

export const hayEnCurso = (estado: EstadoCola): boolean =>
  Object.values(estado.items).some(estaEnCurso);
