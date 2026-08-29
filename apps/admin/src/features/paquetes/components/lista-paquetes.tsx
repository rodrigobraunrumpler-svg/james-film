'use client';

import type { AdminPackageDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { Package } from 'lucide-react';
import { EstadoVacio } from '@/components/shared/estado-vacio';
import { Hoja } from '@/components/shared/hoja';
import { VerEnLaWeb } from '@/components/shared/ver-en-la-web';
import { urlPaquetes } from '@/lib/enlaces';
import { esApiError } from '@/lib/api/errors';
import { moneda } from '@/lib/format';
import { iconoDe } from '@/lib/iconos/mapa';
import { useCategoriasComoOpciones } from '@/lib/catalogo/categorias';
import {
  useBorrarPaquete,
  useDestacarPaquete,
  useGuardarPaquete,
  useOrdenPaquetes,
  usePaquetes,
} from '../hooks/use-paquetes';
import { HojaPaquete } from './hoja-paquete';

export function ListaPaquetes() {
  const { data, isPending, isError, refetch } = usePaquetes();
  const categorias = useCategoriasComoOpciones();
  const { reordenar, fallo } = useOrdenPaquetes();
  const destacar = useDestacarPaquete();
  const guardar = useGuardarPaquete();
  const borrar = useBorrarPaquete();
  const [editando, setEditando] = useState<AdminPackageDto | null | undefined>(undefined);

  if (isPending || categorias.isPending) return <SkeletonPaquetes />;

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="font-medium">No se pudieron cargar los paquetes</p>
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

  const alternarActivo = (p: AdminPackageDto): void => {
    // Desactivar el destacado deja la landing SIN destacado y ninguno lo hereda:
    // la sección sale plana y no falla nada. Se avisa antes, no después.
    if (p.isActive && p.isHighlighted) {
      const seguir = confirm(
        `«${p.name}» es el paquete destacado. Si lo ocultas, la web no destacará ninguno.`,
      );
      if (!seguir) return;
    }
    guardar.mutate({ id: p.id, datos: { isActive: !p.isActive } });
  };

  const pedirBorrado = async (p: AdminPackageDto): Promise<void> => {
    if (p.whatsappClickCount > 0) {
      // Borrarlo pone su packageId a null en cada clic, y son la única métrica
      // de negocio del proyecto.
      toast.error(
        `«${p.name}» tiene ${p.whatsappClickCount} clics registrados. Ocúltalo en vez de borrarlo.`,
      );
      return;
    }
    if (!confirm(`¿Borrar «${p.name}» y sus puntos? No se puede deshacer.`)) return;

    try {
      await borrar.mutateAsync(p.id);
      toast.success('Paquete borrado');
    } catch (e) {
      toast.error(esApiError(e) ? e.message : 'No se pudo borrar.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditando(null)}
          className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
        >
          Nuevo paquete
        </button>
        {/* §9 lo pide para galerías Y paquetes. Aquí es la sección de la
            portada, no una página propia: por eso el ancla. */}
        <VerEnLaWeb url={urlPaquetes()} etiqueta="Ver los paquetes en la web" />
      </div>

      {fallo && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo guardar el orden. Se ha dejado como estaba.
        </p>
      )}

      {data.length === 0 && (
        <EstadoVacio
          Icono={Package}
          titulo="Aún no tienes paquetes"
          explicacion="Los paquetes son lo que vendes: cuántos reels, cuánto duran, cuánto cuestan. Es lo primero que mira quien entra en la web."
          accion="Crear el primero"
          onAccion={() => setEditando(null)}
        />
      )}

      {/* auto-fit con minmax, NUNCA grid-cols-3: es la misma regla que la
          landing (§8), y con un nombre largo `1fr` desborda. */}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
        {data.map((p, i) => {
          const Icono = iconoDe(p.icon);
          return (
            <li key={p.id} className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <Icono aria-hidden className="mt-0.5 size-5 shrink-0 text-neutral-500" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="[overflow-wrap:anywhere]">{p.name}</span>
                    {p.isHighlighted && (
                      <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        Destacado
                      </span>
                    )}
                    {!p.isActive && (
                      <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">
                        Oculto
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-neutral-600">
                    {moneda(p.priceAmount)}
                    {p.priceNote ? ` · ${p.priceNote}` : ''}
                  </span>
                </div>
              </div>

              <ul className="flex flex-col gap-1 text-sm text-neutral-600">
                {p.items.slice(0, 4).map((item) => (
                  <li key={item.id} className={item.included ? '' : 'line-through opacity-60'}>
                    {item.text}
                  </li>
                ))}
                {p.items.length > 4 && (
                  <li className="text-neutral-400">y {p.items.length - 4} más</li>
                )}
              </ul>

              <div className="mt-auto flex flex-wrap gap-1">
                <button
                  type="button"
                  aria-label={`Mover ${p.name} antes`}
                  disabled={i === 0}
                  onClick={() => reordenar(i, i - 1)}
                  className="min-h-11 min-w-11 rounded-md border text-sm disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${p.name} después`}
                  disabled={i >= data.length - 1}
                  onClick={() => reordenar(i, i + 1)}
                  className="min-h-11 min-w-11 rounded-md border text-sm disabled:opacity-40"
                >
                  →
                </button>
                {/* Radio, no checkbox: un checkbox invita a marcar dos y luego a
                    preguntarse por qué se desmarcó el otro solo. */}
                <label className="flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm">
                  <input
                    type="radio"
                    name="destacado"
                    checked={p.isHighlighted}
                    onChange={() => destacar.mutate(p.id)}
                    aria-label={`Destacar ${p.name}`}
                  />
                  Destacar
                </label>
                <button
                  type="button"
                  aria-label={`${p.isActive ? 'Ocultar' : 'Mostrar'} ${p.name}`}
                  onClick={() => alternarActivo(p)}
                  className="min-h-11 rounded-md border px-3 text-sm"
                >
                  {p.isActive ? 'Ocultar' : 'Mostrar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(p)}
                  className="min-h-11 rounded-md border px-3 text-sm"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => void pedirBorrado(p)}
                  className="min-h-11 rounded-md border px-3 text-sm"
                >
                  Borrar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Hoja
        abierta={editando !== undefined}
        onCerrar={() => setEditando(undefined)}
        titulo={editando ? `Editar ${editando.name}` : 'Nuevo paquete'}
      >
        {editando !== undefined && (
          <HojaPaquete
            paquete={editando}
            categorias={categorias.data ?? []}
            onCerrar={() => setEditando(undefined)}
          />
        )}
      </Hoja>
    </div>
  );
}

export function SkeletonPaquetes() {
  return (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-100" />
          <div className="flex flex-col gap-1">
            {Array.from({ length: 4 }, (_, j) => (
              <div key={j} className="h-3 w-full animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
