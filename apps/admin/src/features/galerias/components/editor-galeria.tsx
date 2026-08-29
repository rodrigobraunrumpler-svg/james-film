'use client';

import { esApiError } from '@/lib/api/errors';
import { useCategorias, useGaleria, useReconciliarPendientes } from '../hooks/use-galeria';
import { FormularioGaleria } from './formulario-galeria';
import { SkeletonEditor } from './skeleton-editor';

export function EditorGaleria({ id }: { id: string }) {
  const galeria = useGaleria(id);
  const categorias = useCategorias();

  // Step 0: los PENDING que dejó una pestaña muerta se re-confirman al montar.
  // Va antes de cualquier return: los hooks no pueden ir detrás de una rama.
  useReconciliarPendientes(galeria.data);

  if (galeria.isPending || categorias.isPending) return <SkeletonEditor />;

  if (galeria.isError || categorias.isError) {
    const error = galeria.error ?? categorias.error;
    const esNoEncontrada = esApiError(error) && error.isNotFound;

    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="font-medium">
          {esNoEncontrada ? 'Esta galería ya no existe' : 'No se pudo cargar la galería'}
        </p>
        {!esNoEncontrada && (
          <button
            type="button"
            onClick={() => {
              void galeria.refetch();
              void categorias.refetch();
            }}
            className="min-h-11 rounded-md border px-4 text-sm font-medium"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{galeria.data.title}</h1>
      {/* key por id: navegar de una galería a otra REMONTA el formulario en vez
          de reusar el estado de la anterior, que es cómo se guardan los datos
          de una galería sobre otra. */}
      <FormularioGaleria
        key={galeria.data.id}
        galeria={galeria.data}
        categorias={categorias.data}
      />
    </div>
  );
}
