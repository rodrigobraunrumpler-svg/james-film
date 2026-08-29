'use client';

import type { AdminCategoryDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { esApiError } from '@/lib/api/errors';
import {
  useBorrarCategoria,
  useCategorias,
  useGuardarCategoria,
  useOrdenCategorias,
} from '../hooks/use-categorias';
import { HojaCategoria } from './hoja-categoria';

export function ListaCategorias() {
  const { data, isPending, isError, refetch } = useCategorias();
  const { reordenar, fallo } = useOrdenCategorias();
  const borrar = useBorrarCategoria();
  const guardar = useGuardarCategoria();
  const [editando, setEditando] = useState<AdminCategoryDto | null | undefined>(undefined);

  if (isPending) return <SkeletonCategorias />;

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="font-medium">No se pudieron cargar las categorías</p>
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

  const pedirBorrado = async (c: AdminCategoryDto): Promise<void> => {
    const enUso = c.galleryCount + c.packageCount > 0;
    if (enUso) {
      // Los recuentos viajan con la fila justo para poder decirlo ANTES, en vez
      // de dejar que el servidor lo rechace después.
      toast.error(`«${c.name}» la usan ${c.galleryCount} galerías y ${c.packageCount} paquetes.`);
      return;
    }
    if (!confirm(`¿Borrar «${c.name}»? No se puede deshacer.`)) return;

    try {
      await borrar.mutateAsync(c.id);
      toast.success('Categoría borrada');
    } catch (e) {
      // El 409 del servidor sigue existiendo: la API no puede confiar en que la
      // interfaz haya avisado.
      toast.error(esApiError(e) ? e.message : 'No se pudo borrar.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setEditando(null)}
          className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
        >
          Nueva categoría
        </button>
      </div>

      {fallo && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo guardar el orden. Se ha dejado como estaba.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {data.map((c, i) => (
          <li
            key={c.id}
            className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="aspect-[16/9] w-16 shrink-0 overflow-hidden rounded bg-neutral-100">
                {c.coverUrl && (
                  <img
                    src={c.coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 font-medium">
                  <span className="truncate [overflow-wrap:anywhere]">{c.name}</span>
                  {!c.isActive && (
                    <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">
                      Oculta
                    </span>
                  )}
                </span>
                <span className="truncate text-sm text-neutral-500">
                  /{c.slug} · {c.galleryCount} {c.galleryCount === 1 ? 'galería' : 'galerías'}
                </span>
              </div>
            </div>

            {/* `flex-wrap` y no `shrink-0`: cinco botones de 44 px no caben en
                una pantalla de 320, y §7 no admite scroll horizontal. */}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                aria-label={`Mover ${c.name} antes`}
                disabled={i === 0}
                onClick={() => reordenar(i, i - 1)}
                className="min-h-11 min-w-11 rounded-md border text-sm disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Mover ${c.name} después`}
                disabled={i >= data.length - 1}
                onClick={() => reordenar(i, i + 1)}
                className="min-h-11 min-w-11 rounded-md border text-sm disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`${c.isActive ? 'Ocultar' : 'Mostrar'} ${c.name}`}
                onClick={() => guardar.mutate({ id: c.id, datos: { isActive: !c.isActive } })}
                className="min-h-11 rounded-md border px-3 text-sm"
              >
                {c.isActive ? 'Ocultar' : 'Mostrar'}
              </button>
              <button
                type="button"
                onClick={() => setEditando(c)}
                className="min-h-11 rounded-md border px-3 text-sm"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void pedirBorrado(c)}
                className="min-h-11 rounded-md border px-3 text-sm"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editando !== undefined && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">
            {editando ? `Editar ${editando.name}` : 'Nueva categoría'}
          </h2>
          <HojaCategoria categoria={editando} onCerrar={() => setEditando(undefined)} />
        </div>
      )}
    </div>
  );
}

/** Con la forma real: cuatro filas con su miniatura 16/9. */
export function SkeletonCategorias() {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="aspect-[16/9] w-16 shrink-0 animate-pulse rounded bg-neutral-200" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
