'use client';

import { useSyncExternalStore } from 'react';

/**
 * La conexión, para la cola de subidas y para la banda que la anuncia.
 *
 * `navigator.onLine` NO promete que haya internet: en un portal cautivo o con
 * el 4G agonizando dice `true` y la petición falla igual. Por eso NO sustituye
 * al reintento con espera del motor — solo añade dos cosas que ese reintento no
 * puede saber por su cuenta:
 *
 *  1. Cuándo NO tiene sentido gastar presupuesto. Los cinco minutos de
 *     `PRESUPUESTO_MS` existen para rendirse ante un archivo que no entra;
 *     gastarlos en un túnel es rendirse ante la carretera. Un `false` de
 *     `onLine` sí es fiable en la dirección que importa: si el sistema dice que
 *     no hay red, no la hay.
 *  2. Cuándo volver a intentarlo YA. El evento `online` llega antes que
 *     cualquier espera que hubiéramos programado a ojo.
 */

/** En el servidor no hay `navigator`; se asume que sí hay red. */
export const estaEnLinea = (): boolean =>
  typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * Resuelve al momento si hay red, y si no, en cuanto vuelva. Sin `setInterval`:
 * el evento `online` es exactamente esta señal, y sondear con la pantalla
 * apagada es gastar batería para no enterarse antes.
 */
export function esperarConexion(): Promise<void> {
  if (estaEnLinea()) return Promise.resolve();
  return new Promise((resolver) => {
    const volvio = () => {
      window.removeEventListener('online', volvio);
      resolver();
    };
    window.addEventListener('online', volvio);
  });
}

/** Avisa en los dos sentidos. Devuelve la baja, para el efecto de React. */
export function suscribirConexion(alCambiar: () => void): () => void {
  window.addEventListener('online', alCambiar);
  window.addEventListener('offline', alCambiar);
  return () => {
    window.removeEventListener('online', alCambiar);
    window.removeEventListener('offline', alCambiar);
  };
}

/**
 * La conexión, para React. Boolean, no objeto: `useSyncExternalStore` compara
 * el snapshot por identidad y devolver algo nuevo en cada lectura sería un
 * render en bucle — el mismo fallo que la regla de los selectores de zustand.
 *
 * El snapshot del servidor es `true`: en el HTML no hay `navigator`, y arrancar
 * diciendo «sin conexión» para corregirlo al hidratar sería un parpadeo de una
 * alarma falsa.
 */
export function useEnLinea(): boolean {
  return useSyncExternalStore(suscribirConexion, estaEnLinea, () => true);
}
