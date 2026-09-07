'use client';

import type { AdminCategoryDto } from '@james-film/contracts';
import { Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LuzAmbiente } from '@/components/shared/luz-ambiente';
import { Boton } from '@/components/shared/boton';
import { EstadoVacio } from '@/components/shared/estado-vacio';
import { Hoja } from '@/components/shared/hoja';
import { esApiError } from '@/lib/api/errors';
import {
  useBorrarCategoria,
  useCategorias,
  useGuardarCategoria,
  useOrdenCategorias,
} from '../hooks/use-categorias';
import { HojaCategoria } from './hoja-categoria';
import { TarjetaCategoria } from './tarjeta-categoria';
import { TiraMenu } from './tira-menu';

export function ListaCategorias() {
  const { data, isPending, isError, refetch } = useCategorias();
  const { reordenar, fallo } = useOrdenCategorias();
  const borrar = useBorrarCategoria();
  const guardar = useGuardarCategoria();
  const [editando, setEditando] = useState<AdminCategoryDto | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<AdminCategoryDto | null>(null);

  // El h1 comparte fila con «Nueva categoría»: separarlos los deja en dos
  // líneas distintas, y por eso vive aquí y no en el `page.tsx`.
  const cabecera = (
    <div className="entra flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(19px,3.5vw,24px)] font-extrabold tracking-[-0.02em]">
          Categorías
        </h1>
        <p className="text-ash mt-1 text-sm">
          Son las secciones del menú de la web y el filtro de las galerías.
        </p>
      </div>
      <Boton variante="principal" onClick={() => setEditando(null)}>
        <Plus className="size-3.5" aria-hidden />
        Nueva categoría
      </Boton>
    </div>
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-3.5">
        {cabecera}
        <SkeletonCategorias />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-3.5">
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
    <div className="relative flex flex-col gap-3.5">
      <LuzAmbiente className="-top-48 left-1/4 w-[700px]" />

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
        <>
          <TiraMenu categorias={data} />

          {/* `minmax(0, …)` en la grilla, siempre: sin él un nombre largo la
              desborda y a 320px aparece scroll horizontal. */}
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3.5">
            {data.map((c, i) => (
              <li key={c.id} className="min-w-0">
                <TarjetaCategoria
                  categoria={c}
                  indice={i}
                  total={data.length}
                  i={i + 2}
                  alMover={reordenar}
                  alEditar={() => setEditando(c)}
                  alAlternarVisible={() =>
                    guardar.mutate({ id: c.id, datos: { isActive: !c.isActive } })
                  }
                  alPedirBorrado={() => pedirBorrado(c)}
                />
              </li>
            ))}
          </ul>

          <p className="text-muted max-w-[74ch] text-xs leading-relaxed">
            Ocultar una categoría no borra sus galerías: desaparece del menú y sus galerías siguen
            abriéndose por su link. Es lo que hace falta para retirar una categoría una temporada
            sin romper nada de lo que ya compartiste por WhatsApp.
          </p>
        </>
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
          <div className="flex gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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

/** Con la forma real: la tira del menú y cuatro tarjetas con su portada 16:9. */
export function SkeletonCategorias() {
  return (
    <div className="flex flex-col gap-3.5" aria-hidden>
      <div className="border-line bg-chrome rounded-card h-[42px] animate-pulse border" />
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3.5">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="border-line bg-card rounded-card overflow-hidden border">
            <div className="bg-well aspect-video animate-pulse" />
            <div className="flex flex-col gap-2 p-3">
              <div className="bg-active h-4 w-1/2 animate-pulse rounded" />
              <div className="bg-line h-3 w-2/3 animate-pulse rounded" />
              <div className="bg-line mt-2 h-[5px] w-full animate-pulse rounded-full" />
              <div className="bg-line mt-2 h-8 w-full animate-pulse rounded" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
