'use client';

import type { AdminSocialLinkDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { clasesBoton } from '@/components/shared/boton';
import { esApiError } from '@/lib/api/errors';
import { useBorrarRed, useGuardarRed, useOrdenRedes, useRedes } from '../hooks/use-listas';

const VACIA = { platform: '', handle: '', url: '' };

export function ListaRedes() {
  const { data, isPending } = useRedes();
  const { reordenar, fallo } = useOrdenRedes();
  const guardar = useGuardarRed();
  const borrar = useBorrarRed();
  const [nueva, setNueva] = useState(VACIA);

  // `!data` además de `isPending`: TypeScript no estrecha `data` solo con el
  // booleano, y sin esto el resto del componente iría con `data!`.
  if (isPending || !data) return <p className="text-ash text-sm">Cargando…</p>;

  const anadir = async (): Promise<void> => {
    if (!nueva.platform.trim() || !nueva.url.trim()) return;
    try {
      await guardar.mutateAsync({ datos: nueva });
      setNueva(VACIA);
      toast.success('Red añadida');
    } catch (e) {
      // La plataforma es `@unique`: el servidor nombra el campo en el mensaje.
      toast.error(esApiError(e) ? e.message : 'No se pudo añadir.');
    }
  };

  const eliminar = async (r: AdminSocialLinkDto): Promise<void> => {
    if (!confirm(`¿Borrar el enlace de ${r.platform}?`)) return;
    await borrar.mutateAsync(r.id).catch(() => toast.error('No se pudo borrar.'));
  };

  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <h2 className="text-lg font-semibold">Redes</h2>

      {fallo && (
        <p role="alert" className="text-danger text-sm">
          No se pudo guardar el orden. Se ha dejado como estaba.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {data.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{r.platform}</span>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="dato text-ash truncate text-sm underline"
              >
                {r.handle}
              </a>
            </div>
            {!r.isActive && (
              <span className="bg-active text-ash rounded px-1.5 py-0.5 text-[10px]">Oculta</span>
            )}
            <button
              type="button"
              aria-label={`Subir ${r.platform}`}
              disabled={i === 0}
              onClick={() => reordenar(i, i - 1)}
              className="min-h-11 min-w-11 rounded-md border disabled:opacity-40"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Bajar ${r.platform}`}
              disabled={i >= data.length - 1}
              onClick={() => reordenar(i, i + 1)}
              className="min-h-11 min-w-11 rounded-md border disabled:opacity-40"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`${r.isActive ? 'Ocultar' : 'Mostrar'} ${r.platform}`}
              onClick={() => guardar.mutate({ id: r.id, datos: { isActive: !r.isActive } })}
              className={clasesBoton()}
            >
              {r.isActive ? 'Ocultar' : 'Mostrar'}
            </button>
            <button
              type="button"
              aria-label={`Borrar ${r.platform}`}
              onClick={() => void eliminar(r)}
              className={clasesBoton()}
            >
              Borrar
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="red-platform" className="text-muted text-xs">
            Red
          </label>
          <input
            id="red-platform"
            placeholder="instagram"
            value={nueva.platform}
            onChange={(e) => setNueva({ ...nueva, platform: e.target.value })}
            className="campo bg-well border-line"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="red-handle" className="text-muted text-xs">
            Usuario
          </label>
          <input
            id="red-handle"
            placeholder="James_film30"
            value={nueva.handle}
            onChange={(e) => setNueva({ ...nueva, handle: e.target.value })}
            className="campo bg-well border-line"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="red-url" className="text-muted text-xs">
            Enlace completo
          </label>
          <input
            id="red-url"
            placeholder="https://instagram.com/James_film30"
            value={nueva.url}
            onChange={(e) => setNueva({ ...nueva, url: e.target.value })}
            className="campo bg-well border-line"
          />
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
