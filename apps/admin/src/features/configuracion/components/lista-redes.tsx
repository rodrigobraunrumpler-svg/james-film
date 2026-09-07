'use client';

import type { AdminSocialLinkDto } from '@james-film/contracts';
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Pista } from '@/components/shared/pista';
import { Boton, clasesBoton } from '@/components/shared/boton';
import { Hoja } from '@/components/shared/hoja';
import { iconoDe } from '@/lib/iconos/mapa';
import { esApiError } from '@/lib/api/errors';
import { useBorrarRed, useGuardarRed, useOrdenRedes, useRedes } from '../hooks/use-listas';

const VACIA = { platform: '', handle: '', url: '' };

/** Igual que en el resto del admin: cuadrado, táctil a 44 y denso a 30. */
const ICONO = 'w-11 px-0 lg:w-[30px]';

export function ListaRedes() {
  const { data, isPending } = useRedes();
  const { reordenar, fallo } = useOrdenRedes();
  const guardar = useGuardarRed();
  const borrar = useBorrarRed();
  const [nueva, setNueva] = useState(VACIA);
  const [borrando, setBorrando] = useState<AdminSocialLinkDto | null>(null);

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
    try {
      await borrar.mutateAsync(r.id);
      toast.success('Red borrada');
    } catch {
      toast.error('No se pudo borrar.');
    } finally {
      setBorrando(null);
    }
  };

  return (
    <section className="bg-card border-line rounded-card flex flex-col gap-3 border px-4 py-4">
      <h2 className="text-muted text-xs tracking-[0.1em] uppercase">Redes</h2>

      {fallo && (
        <p role="alert" className="text-danger text-sm">
          No se pudo guardar el orden. Se ha dejado como estaba.
        </p>
      )}

      <ul className="flex flex-col gap-[7px]">
        {data.map((r, i) => {
          const Icono = iconoDe(r.icon ?? r.platform);
          return (
            <li
              key={r.id}
              className="border-line levanta bg-card hover:bg-card-hover rounded-control flex flex-wrap items-center gap-2.5 border px-2.5 py-2"
            >
              <GripVertical className="text-muted size-3.5 shrink-0" aria-hidden />
              <span
                aria-hidden
                className="border-line-strong bg-active flex size-[26px] shrink-0 items-center justify-center rounded-md border"
              >
                <Icono className="text-brass size-3.5" />
              </span>

              <div className="flex min-w-0 flex-1 basis-32 flex-col">
                <span className="dato truncate text-sm">{r.platform}</span>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="dato text-muted truncate text-xs underline-offset-2 hover:underline"
                >
                  {r.handle ?? r.url}
                </a>
              </div>

              {!r.isActive && (
                <span className="bg-active text-ash shrink-0 rounded px-1.5 py-0.5 text-[10px]">
                  Oculta
                </span>
              )}

              <Pista texto={`Subir ${r.platform}`} lado="arriba">
                <button
                  type="button"
                  aria-label={`Subir ${r.platform}`}
                  disabled={i === 0}
                  onClick={() => reordenar(i, i - 1)}
                  className={clasesBoton('secundario', ICONO)}
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
              </Pista>
              <Pista texto={`Bajar ${r.platform}`} lado="arriba">
                <button
                  type="button"
                  aria-label={`Bajar ${r.platform}`}
                  disabled={i >= data.length - 1}
                  onClick={() => reordenar(i, i + 1)}
                  className={clasesBoton('secundario', ICONO)}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </button>
              </Pista>
              <Boton
                aria-label={`${r.isActive ? 'Ocultar' : 'Mostrar'} ${r.platform}`}
                onClick={() => guardar.mutate({ id: r.id, datos: { isActive: !r.isActive } })}
              >
                {r.isActive ? 'Ocultar' : 'Mostrar'}
              </Boton>
              <Boton
                variante="peligro"
                aria-label={`Borrar ${r.platform}`}
                onClick={() => setBorrando(r)}
              >
                Borrar
              </Boton>
            </li>
          );
        })}
      </ul>

      <div className="border-line-strong rounded-control flex flex-wrap items-end gap-2 border border-dashed p-3">
        <div className="flex min-w-0 flex-1 basis-28 flex-col gap-1.5">
          <label htmlFor="red-platform" className="text-muted text-xs">
            Red
          </label>
          <input
            id="red-platform"
            placeholder="instagram"
            value={nueva.platform}
            onChange={(e) => setNueva({ ...nueva, platform: e.target.value })}
            className="campo border-line"
          />
        </div>
        <div className="flex min-w-0 flex-1 basis-28 flex-col gap-1.5">
          <label htmlFor="red-handle" className="text-muted text-xs">
            Usuario
          </label>
          <input
            id="red-handle"
            placeholder="James_film30"
            value={nueva.handle}
            onChange={(e) => setNueva({ ...nueva, handle: e.target.value })}
            className="campo border-line"
          />
        </div>
        <div className="flex min-w-0 flex-1 basis-52 flex-col gap-1.5">
          <label htmlFor="red-url" className="text-muted text-xs">
            Enlace completo
          </label>
          <input
            id="red-url"
            placeholder="https://instagram.com/James_film30"
            value={nueva.url}
            onChange={(e) => setNueva({ ...nueva, url: e.target.value })}
            className="campo border-line"
          />
        </div>
        <Boton onClick={() => void anadir()}>
          <Plus className="size-3.5" aria-hidden />
          Añadir
        </Boton>
      </div>

      <p className="text-muted text-xs">
        Salen en el pie, en este orden. Son enlaces de marca, no compiten con WhatsApp.
      </p>

      {/* `confirm()` no se usa en ninguna parte del admin: en iOS sale como un
          diálogo del SISTEMA y se acepta con el pulgar sin leerlo. */}
      <Hoja
        abierta={borrando !== null}
        onCerrar={() => setBorrando(null)}
        titulo={borrando ? `Borrar ${borrando.platform}` : 'Borrar'}
        descripcion="Desaparece del pie de la web. Puedes volver a añadirla cuando quieras."
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
              onClick={() => void eliminar(borrando)}
            >
              {borrar.isPending ? 'Borrando…' : 'Borrar'}
            </Boton>
          </div>
        )}
      </Hoja>
    </section>
  );
}
