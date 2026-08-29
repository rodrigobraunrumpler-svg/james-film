'use client';

import type { AdminCategoryDto } from '@james-film/contracts';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Boton } from '@/components/shared/boton';
import { EstadoVacio } from '@/components/shared/estado-vacio';
import { Hoja } from '@/components/shared/hoja';
import { esApiError } from '@/lib/api/errors';
import { ocultarSiFalla } from '@/lib/imagen';
import {
  useBorrarCategoria,
  useCategorias,
  useGuardarCategoria,
  useOrdenCategorias,
} from '../hooks/use-categorias';
import { HojaCategoria } from './hoja-categoria';

/** Icono cuadrado de la fila: 44px en táctil, 30 en escritorio. */
const ICONO =
  'flex size-11 shrink-0 items-center justify-center rounded-control border border-line-strong bg-card text-bone transition-colors duration-150 hover:border-line-hover disabled:opacity-35 lg:size-[30px]';

export function ListaCategorias() {
  const { data, isPending, isError, refetch } = useCategorias();
  const { reordenar, fallo } = useOrdenCategorias();
  const borrar = useBorrarCategoria();
  const guardar = useGuardarCategoria();
  const [editando, setEditando] = useState<AdminCategoryDto | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<AdminCategoryDto | null>(null);

  const cabecera = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-[-0.01em]">Categorías</h1>
      <Boton variante="principal" onClick={() => setEditando(null)}>
        <Plus className="size-3.5" aria-hidden />
        Nueva categoría
      </Boton>
    </div>
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-5">
        {cabecera}
        <SkeletonCategorias />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-5">
        {cabecera}
        <div
          role="alert"
          className="border-danger-line bg-danger-bg rounded-card flex flex-col items-start gap-3 border p-5"
        >
          <p className="font-medium">No se pudieron cargar las categorías</p>
          <Boton onClick={() => void refetch()}>Reintentar</Boton>
        </div>
      </div>
    );
  }

  const pedirBorrado = (c: AdminCategoryDto): void => {
    // Los recuentos viajan con la fila justo para poder decirlo ANTES, en vez de
    // dejar que el servidor lo rechace después. El 409 sigue existiendo: la API
    // no puede confiar en que la interfaz haya avisado.
    if (c.galleryCount + c.packageCount > 0) {
      toast.error(`«${c.name}» la usan ${c.galleryCount} galerías y ${c.packageCount} paquetes.`);
      return;
    }
    setBorrando(c);
  };

  const confirmarBorrado = async (c: AdminCategoryDto): Promise<void> => {
    try {
      await borrar.mutateAsync(c.id);
      toast.success('Categoría borrada');
    } catch (e) {
      toast.error(esApiError(e) ? e.message : 'No se pudo borrar.');
    } finally {
      setBorrando(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {cabecera}

      {fallo && (
        <p role="alert" className="text-danger text-sm">
          No se pudo guardar el orden. Se ha dejado como estaba.
        </p>
      )}

      {data.length === 0 ? (
        <EstadoVacio
          Icono={Tags}
          titulo="Aún no tienes categorías"
          explicacion="Una categoría agrupa galerías del mismo tipo: bodas, XV años, cumpleaños. Sin al menos una no puedes crear galerías."
          accion="Crear la primera"
          onAccion={() => setEditando(null)}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((c, i) => (
            <li
              key={c.id}
              className="border-line bg-card hover:border-line-hover rounded-card flex flex-col gap-3 border p-2.5 transition-colors duration-150 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="bg-well border-line aspect-16/10 w-16 shrink-0 overflow-hidden rounded-[5px] border">
                  {c.coverUrl && (
                    <img
                      src={c.coverUrl}
                      alt=""
                      loading="lazy"
                      onError={ocultarSiFalla}
                      className="h-full w-full object-cover object-[center_35%]"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="dato truncate">{c.name}</span>
                    {!c.isActive && (
                      <span className="text-ash bg-active shrink-0 rounded px-1.5 py-0.5 text-[10px]">
                        Oculta
                      </span>
                    )}
                  </span>
                  <span className="text-ash truncate text-sm">
                    /{c.slug} · {c.galleryCount} {c.galleryCount === 1 ? 'galería' : 'galerías'}
                  </span>
                </div>
              </div>

              {/* `flex-wrap` y no `shrink-0`: cinco objetivos de 44px no caben en
                  una pantalla de 320, y §7 no admite scroll horizontal. */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-label={`Mover ${c.name} antes`}
                  disabled={i === 0}
                  onClick={() => reordenar(i, i - 1)}
                  className={ICONO}
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${c.name} después`}
                  disabled={i >= data.length - 1}
                  onClick={() => reordenar(i, i + 1)}
                  className={ICONO}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </button>
                <Boton
                  aria-label={`${c.isActive ? 'Ocultar' : 'Mostrar'} ${c.name}`}
                  onClick={() => guardar.mutate({ id: c.id, datos: { isActive: !c.isActive } })}
                >
                  {c.isActive ? (
                    <EyeOff className="size-3.5" aria-hidden />
                  ) : (
                    <Eye className="size-3.5" aria-hidden />
                  )}
                  {c.isActive ? 'Ocultar' : 'Mostrar'}
                </Boton>
                <Boton onClick={() => setEditando(c)}>Editar</Boton>
                <Boton variante="peligro" onClick={() => pedirBorrado(c)}>
                  Borrar
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Hoja
        abierta={editando !== undefined}
        onCerrar={() => setEditando(undefined)}
        titulo={editando ? `Editar ${editando.name}` : 'Nueva categoría'}
      >
        {editando !== undefined && (
          <HojaCategoria categoria={editando} onCerrar={() => setEditando(undefined)} />
        )}
      </Hoja>

      {/* Confirmación propia, no `confirm()`: en iOS el nativo sale como un
          diálogo del SISTEMA y se acepta con el pulgar sin leerlo. Sin pedir que
          escriba el nombre —aquí no se lleva archivos por delante, y confirmar
          de todo entrena a confirmar sin leer—. */}
      <Hoja
        abierta={borrando !== null}
        onCerrar={() => setBorrando(null)}
        titulo={borrando ? `Borrar «${borrando.name}»` : 'Borrar'}
        descripcion="No se puede deshacer. Está vacía, así que no arrastra ninguna galería."
      >
        {borrando && (
          <div className="flex gap-2 pb-2">
            <Boton className="flex-1" onClick={() => setBorrando(null)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              className="flex-1"
              disabled={borrar.isPending}
              onClick={() => void confirmarBorrado(borrando)}
            >
              {borrar.isPending ? 'Borrando…' : 'Borrar para siempre'}
            </Boton>
          </div>
        )}
      </Hoja>
    </div>
  );
}

/** Con la forma real: cuatro filas con su miniatura 16:10. */
export function SkeletonCategorias() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li
          key={i}
          className="border-line bg-card rounded-card flex items-center gap-3 border p-2.5"
        >
          <div className="bg-well aspect-16/10 w-16 shrink-0 animate-pulse rounded-[5px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="bg-active h-3.5 w-1/3 animate-pulse rounded" />
            <div className="bg-line h-3 w-1/4 animate-pulse rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}
