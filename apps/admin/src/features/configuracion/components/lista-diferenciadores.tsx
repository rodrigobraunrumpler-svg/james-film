'use client';

import type { AdminDifferentiatorDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { esApiError } from '@/lib/api/errors';
import { iconoDe } from '@/lib/iconos/mapa';
import { useIconosDisponibles } from '../hooks/use-iconos';
import {
  useBorrarDiferenciador,
  useDiferenciadores,
  useGuardarDiferenciador,
  useOrdenDiferenciadores,
} from '../hooks/use-listas';

export function ListaDiferenciadores() {
  const { data, isPending } = useDiferenciadores();
  const { data: iconos } = useIconosDisponibles();
  const { reordenar, fallo } = useOrdenDiferenciadores();
  const guardar = useGuardarDiferenciador();
  const borrar = useBorrarDiferenciador();
  const [nuevo, setNuevo] = useState({ title: '', subtitle: '', icon: 'zap' });

  // `!data` además de `isPending`: TypeScript no estrecha `data` solo con el
  // booleano, y sin esto el resto del componente iría con `data!`.
  if (isPending || !data) return <p className="text-sm text-neutral-500">Cargando…</p>;

  const anadir = async (): Promise<void> => {
    if (!nuevo.title.trim()) return;
    try {
      await guardar.mutateAsync({ datos: { ...nuevo, subtitle: nuevo.subtitle || null } });
      setNuevo({ title: '', subtitle: '', icon: 'zap' });
      toast.success('Diferenciador añadido');
    } catch (e) {
      // El título es `@unique`: el mensaje del servidor nombra el campo, así que
      // se muestra tal cual en vez de un «no se pudo» genérico.
      toast.error(esApiError(e) ? e.message : 'No se pudo añadir.');
    }
  };

  const eliminar = async (d: AdminDifferentiatorDto): Promise<void> => {
    if (!confirm(`¿Borrar «${d.title}»?`)) return;
    await borrar.mutateAsync(d.id).catch(() => toast.error('No se pudo borrar.'));
  };

  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <h2 className="text-lg font-semibold">Diferenciadores</h2>

      {fallo && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo guardar el orden. Se ha dejado como estaba.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {data.map((d, i) => {
          const Icono = iconoDe(d.icon);
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <Icono aria-hidden className="size-5 shrink-0 text-neutral-500" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium [overflow-wrap:anywhere]">{d.title}</span>
                {d.subtitle && (
                  <span className="truncate text-sm text-neutral-500">{d.subtitle}</span>
                )}
              </div>
              {!d.isActive && (
                <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px]">Oculto</span>
              )}
              <button
                type="button"
                aria-label={`Subir ${d.title}`}
                disabled={i === 0}
                onClick={() => reordenar(i, i - 1)}
                className="min-h-11 min-w-11 rounded-md border disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Bajar ${d.title}`}
                disabled={i >= data.length - 1}
                onClick={() => reordenar(i, i + 1)}
                className="min-h-11 min-w-11 rounded-md border disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`${d.isActive ? 'Ocultar' : 'Mostrar'} ${d.title}`}
                onClick={() => guardar.mutate({ id: d.id, datos: { isActive: !d.isActive } })}
                className="min-h-11 rounded-md border px-3 text-sm"
              >
                {d.isActive ? 'Ocultar' : 'Mostrar'}
              </button>
              <button
                type="button"
                aria-label={`Borrar ${d.title}`}
                onClick={() => void eliminar(d)}
                className="min-h-11 rounded-md border px-3 text-sm"
              >
                Borrar
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="dif-title" className="text-sm font-medium">
            Título
          </label>
          <input
            id="dif-title"
            value={nuevo.title}
            onChange={(e) => setNuevo({ ...nuevo, title: e.target.value })}
            className="min-h-11 rounded-md border px-3"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="dif-subtitle" className="text-sm font-medium">
            Subtítulo
          </label>
          <input
            id="dif-subtitle"
            value={nuevo.subtitle}
            onChange={(e) => setNuevo({ ...nuevo, subtitle: e.target.value })}
            className="min-h-11 rounded-md border px-3"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dif-icon" className="text-sm font-medium">
            Ícono
          </label>
          <select
            id="dif-icon"
            value={nuevo.icon}
            onChange={(e) => setNuevo({ ...nuevo, icon: e.target.value })}
            className="min-h-11 rounded-md border px-3"
          >
            {(iconos ?? []).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void anadir()}
          className="min-h-11 rounded-md border px-4 text-sm font-medium"
        >
          Añadir
        </button>
      </div>
    </section>
  );
}
