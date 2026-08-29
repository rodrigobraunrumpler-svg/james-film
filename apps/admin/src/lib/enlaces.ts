/**
 * La URL pública de la landing. En desarrollo, el puerto de Astro; en
 * producción, `NEXT_PUBLIC_WEB_URL`.
 *
 * Es `NEXT_PUBLIC_` a propósito: lo consume un componente de cliente para
 * pintar un enlace, y no hay nada secreto en la dirección de una web pública.
 * El día que haya dominio, es una línea del `.env` — el dominio sigue en los
 * pendientes de `CLAUDE.md`.
 */
const BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:4321';

export const urlGaleria = (slug: string): string => `${BASE}/galerias/${slug}`;
export const urlPaquetes = (): string => `${BASE}/#paquetes`;
