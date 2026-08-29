'use client';

import type { AdminGalleryDto } from '@james-film/contracts';
import { useState } from 'react';
import { useCola } from '@/lib/media/cola/store';
import { useEditarMedio } from '../hooks/use-editar-medio';
import { useMarcarPortada, useOrdenMedios } from '../hooks/use-orden-medios';
import { TarjetaMedio, type DatosTarjeta } from './tarjeta-medio';
import { VisorMedio } from './visor-medio';
import { ResumenLote, TeselaSoltar, useSeleccionArchivos } from './zona-soltar';

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
  const { reordenar, fallo } = useOrdenMedios(galeria.id);
  const portada = useMarcarPortada(galeria.id);
  const editar = useEditarMedio(galeria.id);
  const seleccion = useSeleccionArchivos(galeria.id);
  const [viendo, setViendo] = useState<number | null>(null);

  // El visor recorre SOLO lo que está en R2: un archivo a medio subir no tiene
  // nada que enseñar a pantalla completa.
  const visibles = galeria.media.filter((m) => m.status === 'READY');

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 pb-0.75">
        <p className="text-ash text-sm">
          {tarjetas.length === 0
            ? 'Todavía no hay nada en esta galería.'
            : `${tarjetas.length} ${tarjetas.length === 1 ? 'medio' : 'medios'} · arrastra para reordenar`}
        </p>
      </div>

      {fallo && (
        <p role="alert" className="text-danger text-sm">
          No se pudo guardar el orden. Se ha dejado como estaba.
        </p>
      )}

      {/* La tesela de soltar va FUERA del <ul> —con `contents` la lista no crea
          caja y sus <li> caen igual en esta grilla—: dentro contaría como un
          medio más en cualquier recuento, empezando por los tests. */}
      <ResumenLote seleccion={seleccion} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(112px,100%),1fr))] gap-3 lg:grid-cols-6">
        <ul className="contents">
          {tarjetas.map((datos, i) => (
            <TarjetaMedio
              key={datos.clave}
              datos={datos}
              acciones={{
                posicion: i,
                // Solo se reordena lo que el servidor conoce: una tarjeta local
                // todavía no tiene fila que numerar.
                total: galeria.media.length,
                onVer: datos.medio
                  ? () => setViendo(visibles.findIndex((m) => m.id === datos.medio?.id))
                  : undefined,
                onMover: reordenar,
                onPortada: (mediaId) => portada.mutate(mediaId),
                onEditar: (mediaId, cambios) => editar.mutate({ mediaId, datos: cambios }),
              }}
            />
          ))}
        </ul>
        <TeselaSoltar seleccion={seleccion} />
      </div>

      <VisorMedio
        medios={visibles}
        indice={viendo}
        onCerrar={() => setViendo(null)}
        onMover={setViendo}
      />
    </div>
  );
}
