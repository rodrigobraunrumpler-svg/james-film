'use client';

import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { LuzAmbiente } from '@/components/shared/luz-ambiente';
import { clasesBoton } from '@/components/shared/boton';
import { usePanel } from '../hooks/use-panel';
import { useDescartados } from '../hooks/use-descartados';
import { BloqueAtencion } from './bloque-atencion';
import { BloqueClics } from './bloque-clics';
import { BloqueAtajos, BloqueEspacio, BloqueSabados } from './bloque-lateral';
import { SaludoPanel } from './saludo-panel';
import { SkeletonPanel } from './skeleton-panel';

/**
 * El panel. §9 lo dibuja con el número grande arriba; aquí van primero los
 * AVISOS, a propósito: si el último deploy falló, la web sigue enseñando lo de
 * antes, y eso importa más que el total del mes.
 */
export function Panel() {
  const { data, isPending, isError, refetch } = usePanel();
  const { descartados, descartar, listo } = useDescartados();

  if (isPending) return <SkeletonPanel />;

  // Un fallo NO es un estado vacío: `EstadoVacio` empuja a crear algo, y aquí
  // no falta contenido, falla la carga. Lo que hace falta es reintentar.
  if (isError || !data) {
    return (
      <div className="border-danger-line rounded-card bg-danger-bg flex flex-col items-center gap-3 border px-6 py-12 text-center">
        <TriangleAlert className="text-danger size-7" aria-hidden />
        <div>
          <p className="text-lg font-medium">No se pudo cargar el panel</p>
          <p className="text-ash mt-1 text-sm">Puede ser la conexión. Vuelve a intentarlo.</p>
        </div>
        <button type="button" onClick={() => refetch()} className={clasesBoton('principal')}>
          Reintentar
        </button>
      </div>
    );
  }

  const { attention, clicks, storage, deploy, ultimaGaleria, saturdays } = data.data;
  // Hasta que `localStorage` se haya leído se muestran TODOS: filtrar con el
  // conjunto vacío de la primera pasada haría reaparecer avisos ya descartados
  // durante un fotograma.
  const visibles = listo ? attention.filter((a) => !descartados.has(a.id)) : attention;

  return (
    <div className="relative flex flex-col gap-3.5">
      <LuzAmbiente className="-top-40 -right-32 w-[640px]" />

      <SaludoPanel pendientes={visibles.length} />

      {visibles.length > 0 ? (
        <BloqueAtencion avisos={visibles} alDescartar={descartar} />
      ) : (
        <TodoEnOrden />
      )}

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <BloqueClics clicks={clicks} />
        <div className="flex flex-col gap-3.5">
          <BloqueSabados meses={saturdays} />
          <BloqueEspacio storage={storage} />
          <BloqueAtajos ultimaGaleria={ultimaGaleria} pendingChanges={deploy.pendingChanges} />
        </div>
      </div>
    </div>
  );
}

/**
 * Sin avisos, el hueco no se deja vacío: el bloque de atención decide el alto
 * de todo lo de abajo, y que desaparezca haría saltar la pantalla entera al
 * descartar el último. Además es la única confirmación de que no hay nada roto.
 */
function TodoEnOrden() {
  return (
    <p
      className="entra border-line rounded-card text-ash flex items-center gap-2.5 border border-dashed px-4 py-3 text-sm"
      style={{ '--i': 1 } as React.CSSProperties}
    >
      <CheckCircle2 className="text-brass size-4 shrink-0" aria-hidden />
      Todo en orden: nada roto, nada a medias.
    </p>
  );
}
