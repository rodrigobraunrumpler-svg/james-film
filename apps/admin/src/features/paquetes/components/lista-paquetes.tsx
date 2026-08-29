'use client';

import type { AdminPackageDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Package, Plus, Star } from 'lucide-react';
import { Boton, clasesBoton } from '@/components/shared/boton';
import { EstadoVacio } from '@/components/shared/estado-vacio';
import { Hoja } from '@/components/shared/hoja';
import { VerEnLaWeb } from '@/components/shared/ver-en-la-web';
import { urlPaquetes } from '@/lib/enlaces';
import { esApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';
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

/** Icono cuadrado de la tarjeta: 44px en táctil, 30 en escritorio. */
const ICONO =
  'flex size-11 shrink-0 items-center justify-center rounded-control border border-line-strong bg-card text-bone transition-colors duration-150 hover:border-line-hover disabled:opacity-35 lg:size-[30px]';

export function ListaPaquetes() {
  const { data, isPending, isError, refetch } = usePaquetes();
  const categorias = useCategoriasComoOpciones();
  const { reordenar, fallo } = useOrdenPaquetes();
  const destacar = useDestacarPaquete();
  const guardar = useGuardarPaquete();
  const borrar = useBorrarPaquete();
  const [editando, setEditando] = useState<AdminPackageDto | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<AdminPackageDto | null>(null);
  const [ocultando, setOcultando] = useState<AdminPackageDto | null>(null);

  if (isPending || categorias.isPending) return <SkeletonPaquetes />;

  if (isError) {
    return (
      <div
        role="alert"
        className="border-danger-line bg-danger-bg rounded-card flex flex-col items-start gap-3 border p-5"
      >
        <p className="font-medium">No se pudieron cargar los paquetes</p>
        <Boton onClick={() => void refetch()}>Reintentar</Boton>
      </div>
    );
  }

  const alternarActivo = (p: AdminPackageDto): void => {
    // Desactivar el destacado deja la landing SIN destacado y ninguno lo hereda:
    // la sección sale plana y no falla nada. Se avisa antes, no después.
    if (p.isActive && p.isHighlighted) {
      setOcultando(p);
      return;
    }
    guardar.mutate({ id: p.id, datos: { isActive: !p.isActive } });
  };

  const pedirBorrado = (p: AdminPackageDto): void => {
    if (p.whatsappClickCount > 0) {
      // Borrarlo pone su packageId a null en cada clic, y son la única métrica
      // de negocio del proyecto.
      toast.error(
        `«${p.name}» tiene ${p.whatsappClickCount} clics registrados. Ocúltalo en vez de borrarlo.`,
      );
      return;
    }
    setBorrando(p);
  };

  const confirmarBorrado = async (p: AdminPackageDto): Promise<void> => {
    try {
      await borrar.mutateAsync(p.id);
      toast.success('Paquete borrado');
    } catch (e) {
      toast.error(esApiError(e) ? e.message : 'No se pudo borrar.');
    } finally {
      setBorrando(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Paquetes</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* §9 lo pide para galerías Y paquetes. Aquí es la sección de la
              portada, no una página propia: por eso el ancla. */}
          <VerEnLaWeb url={urlPaquetes()} etiqueta="Ver en la web" />
          <Boton variante="principal" onClick={() => setEditando(null)}>
            <Plus className="size-3.5" aria-hidden />
            Nuevo paquete
          </Boton>
        </div>
      </div>

      {fallo && (
        <p role="alert" className="text-danger text-sm">
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
            <li
              key={p.id}
              className={cn(
                'bg-card rounded-card flex flex-col gap-3 border p-4 transition-colors duration-150',
                // El latón marca el destacado, y solo en el BORDE: es el único
                // acento del admin y aquí dice cuál vende James de verdad.
                p.isHighlighted ? 'border-brass' : 'border-line hover:border-line-hover',
                !p.isActive && 'opacity-60',
              )}
            >
              {p.isHighlighted && (
                <span className="text-brass border-brass/40 bg-brass/10 -mt-0.5 self-start rounded px-1.5 py-0.5 text-[10px] tracking-[0.12em] uppercase">
                  Nuestro más vendido
                </span>
              )}

              <div className="flex items-start gap-3">
                <Icono aria-hidden className="text-brass mt-0.5 size-5 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="dato">{p.name}</span>
                    {!p.isActive && (
                      <span className="text-ash bg-active rounded px-1.5 py-0.5 text-[10px]">
                        Oculto
                      </span>
                    )}
                  </span>
                  {/* El precio, en grande: es lo que se compara de un vistazo. */}
                  <span className="text-lg font-semibold tabular-nums">
                    {moneda(p.priceAmount)}
                  </span>
                  {p.priceNote && <span className="text-muted text-xs">{p.priceNote}</span>}
                </div>
              </div>

              <ul className="text-ash flex flex-col gap-1 text-sm">
                {p.items.slice(0, 4).map((item) => (
                  <li key={item.id} className={item.included ? '' : 'text-muted line-through'}>
                    {item.text}
                  </li>
                ))}
                {p.items.length > 4 && <li className="text-muted">y {p.items.length - 4} más</li>}
              </ul>

              <div className="mt-auto flex flex-wrap gap-1">
                <button
                  type="button"
                  aria-label={`Mover ${p.name} antes`}
                  disabled={i === 0}
                  onClick={() => reordenar(i, i - 1)}
                  className={ICONO}
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${p.name} después`}
                  disabled={i >= data.length - 1}
                  onClick={() => reordenar(i, i + 1)}
                  className={ICONO}
                >
                  <ArrowRight className="size-3.5" aria-hidden />
                </button>
                {/* Radio de verdad bajo `sr-only`: un checkbox invita a marcar
                    dos y luego a preguntarse por qué se desmarcó el otro solo,
                    y el radio nativo trae teclado y lector de pantalla gratis. */}
                <label className="relative">
                  <input
                    type="radio"
                    name="destacado"
                    checked={p.isHighlighted}
                    onChange={() => destacar.mutate(p.id)}
                    aria-label={`Destacar ${p.name}`}
                    className="peer sr-only"
                  />
                  <span
                    className={clasesBoton(
                      'secundario',
                      'peer-checked:border-brass peer-checked:text-brass peer-focus-visible:outline-brass cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
                    )}
                  >
                    <Star
                      className={cn('size-3.5', p.isHighlighted && 'fill-current')}
                      aria-hidden
                    />
                    Destacar
                  </span>
                </label>
                <Boton
                  aria-label={`${p.isActive ? 'Ocultar' : 'Mostrar'} ${p.name}`}
                  onClick={() => alternarActivo(p)}
                >
                  {p.isActive ? 'Ocultar' : 'Mostrar'}
                </Boton>
                <Boton onClick={() => setEditando(p)}>Editar</Boton>
                <Boton variante="peligro" onClick={() => pedirBorrado(p)}>
                  Borrar
                </Boton>
              </div>
            </li>
          );
        })}
      </ul>

      <Hoja
        abierta={ocultando !== null}
        onCerrar={() => setOcultando(null)}
        titulo={ocultando ? `Ocultar «${ocultando.name}»` : 'Ocultar'}
        descripcion="Es el paquete destacado. Si lo ocultas, la web no destacará ninguno: la sección sale plana."
      >
        {ocultando && (
          <div className="flex gap-2 pb-2">
            <Boton className="flex-1" onClick={() => setOcultando(null)}>
              Cancelar
            </Boton>
            <Boton
              variante="principal"
              className="flex-1"
              onClick={() => {
                guardar.mutate({ id: ocultando.id, datos: { isActive: false } });
                setOcultando(null);
              }}
            >
              Ocultarlo igual
            </Boton>
          </div>
        )}
      </Hoja>

      {/* Confirmación propia, no `confirm()`: en iOS el nativo sale como un
          diálogo del SISTEMA y se acepta con el pulgar sin leerlo. */}
      <Hoja
        abierta={borrando !== null}
        onCerrar={() => setBorrando(null)}
        titulo={borrando ? `Borrar «${borrando.name}»` : 'Borrar'}
        descripcion="Se borran también sus puntos. No se puede deshacer."
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
        <li key={i} className="border-line bg-card rounded-card flex flex-col gap-3 border p-4">
          <div className="bg-active h-4 w-2/3 animate-pulse rounded" />
          <div className="bg-active h-5 w-1/3 animate-pulse rounded" />
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 4 }, (_, j) => (
              <div key={j} className="bg-line h-3 w-full animate-pulse rounded" />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
