'use client';

import type { AdminDifferentiatorDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { Pista } from '@/components/shared/pista';
import { Boton, clasesBoton } from '@/components/shared/boton';
import { Hoja } from '@/components/shared/hoja';
import { SelectorIcono } from '@/components/shared/selector-icono';
import { VistaPreviaDiferenciadores } from './vista-previa-diferenciadores';
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
  const [borrando, setBorrando] = useState<AdminDifferentiatorDto | null>(null);
  /**
   * Cuál se está editando, y su borrador.
   *
   * No se podía editar ninguno: la fila traía subir, bajar, ocultar y borrar, y
   * para cambiar una coma del subtítulo había que **borrarlo y volver a
   * escribirlo entero** —perdiendo su sitio en el orden—. El endpoint
   * (`PATCH /admin/differentiators/:id`) y el hook ya existían desde la fase 4;
   * lo único que faltaba era la pantalla.
   *
   * Se edita EN LA FILA y no en una hoja: son tres campos y el que edita quiere
   * verlos junto a los otros tres diferenciadores para no repetirse.
   */
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState({ title: '', subtitle: '', icon: 'zap' });

  // `!data` además de `isPending`: TypeScript no estrecha `data` solo con el
  // booleano, y sin esto el resto del componente iría con `data!`.
  if (isPending || !data) return <p className="text-ash text-sm">Cargando…</p>;

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

  const abrirEdicion = (d: AdminDifferentiatorDto): void => {
    setEditando(d.id);
    setBorrador({ title: d.title, subtitle: d.subtitle ?? '', icon: d.icon ?? 'zap' });
  };

  const guardarEdicion = async (id: string): Promise<void> => {
    if (!borrador.title.trim()) return;
    try {
      await guardar.mutateAsync({
        id,
        // `null` BORRA el subtítulo y `''` no es lo mismo: vaciar el campo tiene
        // que quitarlo de la web, no guardar una cadena vacía.
        datos: { ...borrador, subtitle: borrador.subtitle.trim() || null },
      });
      setEditando(null);
      toast.success('Diferenciador guardado');
    } catch (e) {
      toast.error(esApiError(e) ? e.message : 'No se pudo guardar.');
    }
  };

  const eliminar = async (d: AdminDifferentiatorDto): Promise<void> => {
    try {
      await borrar.mutateAsync(d.id);
      toast.success('Diferenciador borrado');
    } catch {
      toast.error('No se pudo borrar.');
    } finally {
      setBorrando(null);
    }
  };

  return (
    // Dos columnas como el resto de pestañas: la lista sola dejaba media
    // pantalla vacía a la derecha, y lo que va ahí no es relleno — es dónde
    // acaba lo que se está editando.
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="bg-card border-line rounded-card flex min-w-0 flex-col gap-3 border px-4 py-4">
        <div>
          <h2 className="text-muted text-xs tracking-[0.1em] uppercase">Diferenciadores</h2>
          <p className="text-muted mt-1.5 text-xs leading-relaxed">
            Tres o cuatro, no diez: son las razones por las que alguien te elige a ti. Con más, no
            se lee ninguna.
          </p>
        </div>

        {fallo && (
          <p role="alert" className="text-danger text-sm">
            No se pudo guardar el orden. Se ha dejado como estaba.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {data.map((d, i) => {
            const Icono = iconoDe(d.icon);

            if (editando === d.id) {
              return (
                <li
                  key={d.id}
                  className="border-brass bg-card rounded-control flex flex-wrap items-end gap-2 border px-2.5 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <label htmlFor={`dif-t-${d.id}`} className="text-muted text-xs">
                      Título
                    </label>
                    <input
                      id={`dif-t-${d.id}`}
                      autoFocus
                      value={borrador.title}
                      onChange={(e) => setBorrador({ ...borrador, title: e.target.value })}
                      className="campo border-line"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <label htmlFor={`dif-s-${d.id}`} className="text-muted text-xs">
                      Subtítulo
                    </label>
                    <input
                      id={`dif-s-${d.id}`}
                      value={borrador.subtitle}
                      onChange={(e) => setBorrador({ ...borrador, subtitle: e.target.value })}
                      className="campo border-line"
                    />
                  </div>
                  <div className="flex w-40 flex-col gap-1.5">
                    <label htmlFor={`dif-i-${d.id}`} className="text-muted text-xs">
                      Ícono
                    </label>
                    <SelectorIcono
                      id={`dif-i-${d.id}`}
                      valor={borrador.icon}
                      opciones={iconos ?? []}
                      onCambiar={(icon) => setBorrador({ ...borrador, icon })}
                    />
                  </div>
                  <Boton onClick={() => setEditando(null)}>Cancelar</Boton>
                  <Boton
                    variante="principal"
                    disabled={!borrador.title.trim() || guardar.isPending}
                    onClick={() => void guardarEdicion(d.id)}
                  >
                    {guardar.isPending ? 'Guardando…' : 'Guardar'}
                  </Boton>
                </li>
              );
            }

            return (
              <li
                key={d.id}
                className="border-line levanta bg-card rounded-control flex flex-wrap items-center gap-2.5 border px-2.5 py-2"
              >
                <span
                  aria-hidden
                  className="border-line-strong bg-active flex size-[26px] shrink-0 items-center justify-center rounded-md border"
                >
                  <Icono className="text-brass size-3.5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium [overflow-wrap:anywhere]">{d.title}</span>
                  {d.subtitle && <span className="text-ash truncate text-sm">{d.subtitle}</span>}
                </div>
                {!d.isActive && (
                  <span className="bg-active text-ash rounded px-1.5 py-0.5 text-[10px]">
                    Oculto
                  </span>
                )}
                <Pista texto={`Subir ${d.title}`} lado="arriba">
                  <button
                    type="button"
                    aria-label={`Subir ${d.title}`}
                    disabled={i === 0}
                    onClick={() => reordenar(i, i - 1)}
                    className={clasesBoton('secundario', 'w-11 px-0 lg:w-[30px]')}
                  >
                    <ArrowUp className="size-3.5" aria-hidden />
                  </button>
                </Pista>
                <Pista texto={`Bajar ${d.title}`} lado="arriba">
                  <button
                    type="button"
                    aria-label={`Bajar ${d.title}`}
                    disabled={i >= data.length - 1}
                    onClick={() => reordenar(i, i + 1)}
                    className={clasesBoton('secundario', 'w-11 px-0 lg:w-[30px]')}
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                  </button>
                </Pista>
                <Pista texto={`Editar ${d.title}`} lado="arriba">
                  <button
                    type="button"
                    aria-label={`Editar ${d.title}`}
                    onClick={() => abrirEdicion(d)}
                    className={clasesBoton('secundario', 'w-11 px-0 lg:w-[30px]')}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                </Pista>
                <button
                  type="button"
                  aria-label={`${d.isActive ? 'Ocultar' : 'Mostrar'} ${d.title}`}
                  onClick={() => guardar.mutate({ id: d.id, datos: { isActive: !d.isActive } })}
                  className={clasesBoton()}
                >
                  {d.isActive ? 'Ocultar' : 'Mostrar'}
                </button>
                <button
                  type="button"
                  aria-label={`Borrar ${d.title}`}
                  onClick={() => setBorrando(d)}
                  className={clasesBoton('peligro')}
                >
                  Borrar
                </button>
              </li>
            );
          })}
        </ul>

        <div className="border-line-strong rounded-control flex flex-wrap items-end gap-2 border border-dashed p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="dif-title" className="text-muted text-xs">
              Título
            </label>
            <input
              id="dif-title"
              value={nuevo.title}
              onChange={(e) => setNuevo({ ...nuevo, title: e.target.value })}
              className="campo border-line"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="dif-subtitle" className="text-muted text-xs">
              Subtítulo
            </label>
            <input
              id="dif-subtitle"
              value={nuevo.subtitle}
              onChange={(e) => setNuevo({ ...nuevo, subtitle: e.target.value })}
              className="campo border-line"
            />
          </div>
          <div className="flex w-40 flex-col gap-1.5">
            <label htmlFor="dif-icon" className="text-muted text-xs">
              Ícono
            </label>
            {/* El mismo selector que paquetes: un ícono se elige por su FORMA, y
              un `<select>` de texto obliga a leer «bar-chart-3» e imaginárselo. */}
            <SelectorIcono
              id="dif-icon"
              valor={nuevo.icon}
              opciones={iconos ?? []}
              onCambiar={(icon) => setNuevo({ ...nuevo, icon })}
            />
          </div>
          <Boton onClick={() => void anadir()}>
            <Plus className="size-3.5" aria-hidden />
            Añadir
          </Boton>
        </div>

        {/* `confirm()` no se usa en ninguna parte del admin: en iOS sale como
            un diálogo del SISTEMA y se acepta con el pulgar sin leerlo. */}
        <Hoja
          abierta={borrando !== null}
          onCerrar={() => setBorrando(null)}
          titulo={borrando ? `Borrar «${borrando.title}»` : 'Borrar'}
          descripcion="Desaparece de la web. Puedes volver a escribirlo cuando quieras."
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

      <div className="lg:sticky lg:top-0">
        <VistaPreviaDiferenciadores lista={data} />
      </div>
    </div>
  );
}
