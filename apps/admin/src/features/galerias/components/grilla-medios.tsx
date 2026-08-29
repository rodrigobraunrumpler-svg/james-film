'use client';

import type { AdminGalleryDto } from '@james-film/contracts';
import { useCola } from '../cola/store';
import { TarjetaMedio, type DatosTarjeta } from './tarjeta-medio';

/**
 * La grilla se pinta desde `gallery.media` (TanStack Query), NO desde la cola.
 *
 * La fila PENDING existe desde el presign, así que la cola no pinta tarjeta
 * propia para lo que ya tiene `mediaId`: solo DECORA la que coincide. Los
 * archivos que aún no lo tienen se pintan como tarjetas locales con clave
 * `clientUploadId`. Sin esto, cada archivo en vuelo aparecería DOS veces.
 */
export function GrillaMedios({ galeria }: { galeria: AdminGalleryDto }) {
  // Se selecciona el RECORD, cuya referencia solo cambia cuando cambia la cola.
  // Con `Object.values(...)` dentro del selector, cada render devolvería un
  // array nuevo, useSyncExternalStore lo leería como estado distinto y React
  // entraría en bucle. Verificado: «Maximum update depth exceeded».
  const items = useCola((e) => e.items);
  const deLaGaleria = Object.values(items).filter((i) => i.galleryId === galeria.id);
  const porMediaId = new Map(deLaGaleria.filter((i) => i.mediaId).map((i) => [i.mediaId, i]));

  const tarjetas: DatosTarjeta[] = [
    ...galeria.media.map((medio) => ({
      clave: medio.id,
      galleryId: galeria.id,
      nombre: medio.alt ?? medio.type,
      posterUrl: medio.posterUrl ?? (medio.type === 'PHOTO' ? medio.url : null),
      medio,
      item: porMediaId.get(medio.id),
    })),
    ...deLaGaleria
      .filter((i) => !i.mediaId || !galeria.media.some((m) => m.id === i.mediaId))
      .map((item) => ({
        clave: item.clientUploadId,
        galleryId: galeria.id,
        nombre: item.archivo.name,
        item,
      })),
  ];

  if (tarjetas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">
        Todavía no hay nada en esta galería.
      </p>
    );
  }

  return (
    // minmax(0,1fr) y no grid-cols-N: con un nombre largo, 1fr desborda (§7).
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(140px,100%),1fr))] gap-3">
      {tarjetas.map((datos) => (
        <TarjetaMedio key={datos.clave} datos={datos} />
      ))}
    </ul>
  );
}
