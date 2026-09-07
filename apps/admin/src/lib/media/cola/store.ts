'use client';

import { useStore } from 'zustand';
import type { QueryClient } from '@tanstack/react-query';
import { keys } from '@/lib/api/keys';
import { prepararArchivo } from '../validacion/preparar';
import { medios } from '../servicios';
import { esperarConexion } from './conexion';
import { crearCola, type EstadoCola } from './motor';
import { subir } from './subir';
import type { ItemCola } from './tipos';

/**
 * Singleton de MÓDULO, no creado dentro de un componente: con Context, cada
 * tick de progreso re-renderiza a todos los consumidores, y son decenas por
 * segundo con tres subidas en vuelo.
 *
 * Vive fuera de React también porque la cola sobrevive a la navegación: James
 * puede irse a «Galerías» y seguir viendo `Subiendo 3 de 8`.
 */
export const cola = crearCola({
  preparar: (archivo, tipo, onEtapa) => prepararArchivo(archivo, tipo, undefined, onEtapa),
  firmar: async (galleryId, item) => {
    const { data } = await medios.firmar(galleryId, item as never);
    return data[0];
  },
  subir: (opciones) => subir(opciones),
  confirmar: async (mediaId) => (await medios.confirmar(mediaId)).data,
  borrar: async (mediaId) => {
    await medios.borrar(mediaId);
  },
  nuevoId: () => crypto.randomUUID(),
  ahora: () => Date.now(),
  dormir: (ms) => new Promise((r) => setTimeout(r, ms)),
  esperarConexion,
});

/**
 * La cola NO pinta la grilla: la grilla sale de `gallery.media` (TanStack
 * Query). Esto solo avisa de que hay que releerla.
 */
export function conectarCache(qc: QueryClient): void {
  cola.alCambiarLaGaleria = (galleryId) => {
    void qc.invalidateQueries({ queryKey: keys.galleries.detail(galleryId) });
    void qc.invalidateQueries({ queryKey: keys.galleries.lists() });
  };
}

export const useCola = <T>(selector: (estado: EstadoCola) => T): T =>
  useStore(cola.store, selector);

/** Selector por item: solo re-renderiza la tarjeta que cambió, no la grilla. */
export const useItemCola = (clientUploadId: string | null): ItemCola | undefined =>
  useCola((e) => (clientUploadId ? e.items[clientUploadId] : undefined));
