'use client';

import { esApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';
import { useFiltrosGalerias } from '../hooks/use-filtros-galerias';
import { useGalerias } from '../hooks/use-galerias';
import { EstadoVacio } from './estado-vacio';
import { FilaGaleria } from './fila-galeria';
import { SkeletonLista } from './skeleton-lista';

export function ListaGalerias() {
  const { filtros, setFiltros } = useFiltrosGalerias();
  const { data, isPending, isFetching, isError, error, refetch } = useGalerias(filtros);

  // PRIMERA carga: skeleton. Un refetch NO vuelve aquí (keepPreviousData).
  if (isPending) return <SkeletonLista />;

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="font-medium">No se pudieron cargar las galerías</p>
        <p className="text-sm text-neutral-600">
          {esApiError(error) ? error.message : 'Revisa tu conexión.'}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="min-h-11 rounded-md border px-4 text-sm font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const galerias = data.data;
  const meta = data.meta;

  if (galerias.length === 0 && meta?.currentPage === 1) return <EstadoVacio />;

  return (
    <div className="flex flex-col gap-4">
      {/* Refetch con datos en pantalla: se atenúa, no se sustituye por skeleton. */}
      <ul className={cn('flex flex-col gap-3 transition-opacity', isFetching && 'opacity-60')}>
        {galerias.map((g) => (
          <FilaGaleria key={g.id} galeria={g} />
        ))}
      </ul>

      {meta && meta.pageCount > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <button
            type="button"
            // `isFirstPage` viaja en el meta justo para esto: el cliente no repite
            // la aritmética de paginación en cada control que pinta.
            disabled={meta.isFirstPage}
            onClick={() => void setFiltros({ page: meta.previousPage })}
            className="min-h-11 rounded-md border px-4 text-sm font-medium disabled:opacity-40"
          >
            Anterior
          </button>

          <span className="text-sm text-neutral-600">
            Página {meta.currentPage} de {meta.pageCount} · {meta.totalCount} en total
          </span>

          <button
            type="button"
            disabled={meta.isLastPage}
            onClick={() => void setFiltros({ page: meta.nextPage })}
            className="min-h-11 rounded-md border px-4 text-sm font-medium disabled:opacity-40"
          >
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
}
