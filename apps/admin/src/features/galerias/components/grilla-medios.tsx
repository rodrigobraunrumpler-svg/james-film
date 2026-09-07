'use client';

import type { AdminGalleryDto } from '@james-film/contracts';
import { WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useEnLinea } from '@/lib/media/cola/conexion';
import { estaEnCurso } from '@/lib/media/cola/tipos';
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

  // Lo que hay que mirar DURANTE una subida no es el total, es cuántas van y
  // cuántas se cayeron. Con un solo número —«32 medios»— James no sabe si
  // quedan tres subiendo o si una falló hace un minuto.
  const enLinea = useEnLinea();
  const subiendo = deLaGaleria.filter(estaEnCurso).length;
  const fallidos = deLaGaleria.filter((i) => i.estado === 'FALLIDO').length;
  // Lo que queda por subir cuando se cae la red: lo que está en vuelo más lo
  // que espera turno. Los fallidos ya no cuentan — ésos piden una decisión.
  const enEspera = deLaGaleria.filter(
    (i) => estaEnCurso(i) || i.estado === 'SELECCIONADO',
  ).length;

  return (
    <div className="flex flex-col gap-3">
      {/* La banda va ARRIBA y EN EL FLUJO, no flotando: un elemento fijo no
          ocupa sitio y taparía justo la tesela que está subiendo, que es la que
          hay que mirar. Solo sale si hay algo pendiente — sin nada en cola, un
          corte de red no cambia nada de esta pantalla y avisar sería ruido. */}
      {!enLinea && enEspera > 0 && (
        <p
          role="status"
          className="border-danger-line bg-danger-bg rounded-control flex flex-wrap items-center gap-x-2.5 gap-y-1 border px-3 py-2.5 text-sm"
        >
          <WifiOff className="text-danger size-4 shrink-0" aria-hidden strokeWidth={2} />
          <span className="text-bone font-medium">Sin conexión.</span>
          <span className="text-ash">
            {enEspera === 1 ? 'La que falta sigue' : `Las ${enEspera} que faltan siguen`} en cola.
          </span>
          {/* La frase se repite en la barra de arriba, y es a propósito: la
              barra solo sale con algo EN VUELO (`hayEnCurso`), así que con la
              red caída y tres archivos esperando turno esta banda es lo único
              que hay. Cada una tiene que sostenerse sola; no puede dar por
              hecha a la otra.

              Y se dice lo que VA A PASAR, no una cuenta atrás: se reanuda con
              el evento `online`, así que un «reintentando en 8 s» sería mentira
              en los dos sentidos —ni espera ocho segundos ni es un reintento a
              ciegas—. */}
          <span className="text-muted ml-auto text-xs">Se reanuda solo al volver.</span>
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pb-0.75">
        <p className="text-ash flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {tarjetas.length === 0 ? (
            'Todavía no hay nada en esta galería.'
          ) : (
            <>
              <span>
                {tarjetas.length} {tarjetas.length === 1 ? 'medio' : 'medios'}
              </span>
              {subiendo > 0 && (
                <>
                  <span className="text-line-strong" aria-hidden>
                    |
                  </span>
                  <span className="text-brass flex items-center gap-1.5">
                    <span className="bg-brass-relleno size-1.5 rounded-full" aria-hidden />
                    {subiendo} subiendo
                  </span>
                </>
              )}
              {fallidos > 0 && (
                <>
                  <span className="text-line-strong" aria-hidden>
                    |
                  </span>
                  <span className="text-danger flex items-center gap-1.5">
                    <span className="bg-danger size-1.5 rounded-full" aria-hidden />
                    {fallidos} {fallidos === 1 ? 'falló' : 'fallaron'}
                  </span>
                </>
              )}
              <span className="text-line-strong" aria-hidden>
                |
              </span>
              {/* «Ordena con las flechas», no «arrastra»: el arrastre nativo de
                  HTML5 no existe en iOS, así que en el móvil de James la frase
                  describía algo que no se puede hacer. La pista se pone en el
                  camino que SÍ hay en cada sitio. */}
              <span className="lg:hidden">ordena con las flechas del ⋯</span>
              <span className="hidden lg:inline">arrastra para reordenar</span>
            </>
          )}
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
