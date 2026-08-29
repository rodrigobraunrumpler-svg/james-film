'use client';

import type { AdminPackageDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { Boton } from '@/components/shared/boton';
import { EstadoVacio } from '@/components/shared/estado-vacio';
import { Hoja } from '@/components/shared/hoja';
import { VerEnLaWeb } from '@/components/shared/ver-en-la-web';
import { urlPaquetes } from '@/lib/enlaces';
import { esApiError } from '@/lib/api/errors';
import { ocultarSiFalla } from '@/lib/imagen';
import { cn } from '@/lib/utils/cn';
import { monedaPartida } from '@/lib/format';
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
  const [acciones, setAcciones] = useState<AdminPackageDto | null>(null);

  const porId = new Map((categorias.data ?? []).map((c) => [c.id, c.name]));
  // Mientras nadie haya pulsado nada, el contador no informa y ocupa medio pie.
  // En cuanto hay tráfico, un 0 pasa a ser el dato más importante de la tarjeta.
  const hayClics = (data ?? []).some((p) => p.whatsappClickCount > 0);

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
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Paquetes</h1>
          <p className="text-ash text-sm">Lo primero que mira quien entra en la web.</p>
        </div>
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
      {/* auto-fit con minmax, NUNCA grid-cols-3: es la misma regla que la
          landing (§8), y con un nombre largo `1fr` desborda. */}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
        {data.map((p, i) => {
          const Icono = iconoDe(p.icon);
          const precio = monedaPartida(p.priceAmount);
          const nombres = p.categoryIds
            .map((id) => porId.get(id))
            .filter((n): n is string => Boolean(n));
          return (
            <li
              key={p.id}
              className={cn(
                'group rounded-card relative isolate flex flex-col overflow-hidden border transition-colors duration-150',
                // El latón marca el destacado, y solo en el BORDE: es el único
                // acento del admin y aquí dice cuál vende James de verdad. Con
                // seis paquetes el borde solo se pierde, así que además sube un
                // escalón de superficie — uno, no un relleno.
                p.isHighlighted
                  ? 'border-brass bg-card-hover'
                  : 'border-line bg-card hover:border-line-hover',
                !p.isActive && 'opacity-60',
              )}
            >
              {/* La imagen de fondo del paquete, la misma que usará la landing.
                  Sin esto el campo solo escribe: James la sube y no tiene forma
                  de saber si quedó bien. Al 14% y bajo un velo que arranca a
                  media tarjeta, para que el pie y los puntos sigan legibles
                  encima de cualquier foto. */}
              {p.imageUrl && (
                <>
                  <img
                    src={p.imageUrl}
                    alt=""
                    loading="lazy"
                    onError={ocultarSiFalla}
                    className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.14]"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-0 -z-10 bg-gradient-to-b from-transparent',
                      p.isHighlighted ? 'to-card-hover' : 'to-card',
                    )}
                  />
                </>
              )}
              {/* Destacar arriba a la derecha y siempre visible: es la única
                  decisión de esta pantalla que cambia lo que ve un cliente. El
                  resto de acciones va al menú, que no compite con el precio. */}
              <div className="absolute top-3 right-3 flex items-center gap-1">
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
                    className={cn(
                      'peer-focus-visible:outline-brass rounded-control flex min-h-11 cursor-pointer items-center gap-1.5 px-2 text-xs transition-colors duration-150 peer-focus-visible:outline-2 lg:min-h-7',
                      p.isHighlighted ? 'text-brass' : 'text-muted hover:text-ash',
                    )}
                  >
                    <Star
                      className={cn('size-3.5', p.isHighlighted && 'fill-current')}
                      aria-hidden
                    />
                    Destacar
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setAcciones(p)}
                  aria-label={`Acciones de ${p.name}`}
                  className="text-muted hover:text-bone rounded-control flex size-11 items-center justify-center transition-colors duration-150 lg:size-7"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </button>
              </div>

              <div className="flex flex-col gap-2 p-4 pr-32">
                <span className="flex items-center gap-2">
                  <Icono aria-hidden className="text-brass size-4 shrink-0" />
                  {/* Sin `uppercase`: los nombres del seed YA vienen en mayúsculas, y
                      forzarlo convertiría un «Javier Rojas» escrito a mano en
                      «JAVIER ROJAS». El dato se pinta como se escribió. */}
                  <span className="dato font-medium tracking-[0.04em]">{p.name}</span>
                  {!p.isActive && (
                    <span className="text-ash bg-active shrink-0 rounded px-1.5 py-0.5 text-[10px]">
                      Oculto
                    </span>
                  )}
                </span>

                {p.subtitle && <span className="text-ash dato text-sm">{p.subtitle}</span>}
                {p.idealFor && (
                  <span className="text-muted dato text-xs">Ideal para {p.idealFor}</span>
                )}

                {/* El hueco se reserva SIEMPRE: si la insignia apareciera de la
                    nada, al destacar la tarjeta crecería una línea de golpe y
                    las de al lado se moverían con ella. */}
                <span className="flex min-h-[19px] items-center">
                  {p.isHighlighted && (
                    <span className="text-brass border-brass/40 bg-brass/10 rounded px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase">
                      {p.badgeText ?? 'Nuestro más vendido'}
                    </span>
                  )}
                </span>

                {/* Los céntimos, más pequeños: `S/ 300` es lo que se compara y
                    `,00` no puede pesar lo mismo. */}
                <span className="flex items-baseline gap-0.5 tabular-nums">
                  <span className="text-2xl font-semibold">{precio.entero}</span>
                  <span className="text-ash text-sm">{precio.decimales}</span>
                </span>
                {p.priceNote && <span className="text-muted -mt-1 text-xs">{p.priceNote}</span>}
              </div>

              <ul className="text-ash flex flex-col gap-1.5 px-4 text-sm">
                {p.items.map((item) => (
                  <li
                    key={item.id}
                    className={cn('flex gap-2', !item.included && 'text-muted line-through')}
                  >
                    <span aria-hidden className="text-line-hover">
                      ·
                    </span>
                    <span className="dato">{item.text}</span>
                  </li>
                ))}
              </ul>

              {/* El pie: en qué categorías aparece y cuántos clics ha traído.
                  `mt-auto` para que las tres tarjetas lo alineen aunque tengan
                  distinto número de puntos. */}
              <div className="border-line mt-auto flex flex-wrap items-center gap-2 border-t p-3">
                {nombres.map((n) => (
                  <span key={n} className="text-ash bg-active rounded px-1.5 py-0.5 text-[10px]">
                    {n}
                  </span>
                ))}
                {hayClics && (
                  <span
                    className="text-muted ml-auto shrink-0 text-xs tabular-nums"
                    title="Clics a WhatsApp atribuidos a este paquete"
                  >
                    {p.whatsappClickCount} {p.whatsappClickCount === 1 ? 'clic' : 'clics'}
                  </span>
                )}
              </div>

              {/* Los botones de orden, discretos y abajo: reordenar es raro y no
                  merece el sitio que ocupaba en la fila de acciones. */}
              <div className="absolute right-3 bottom-3 flex gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
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
              </div>
            </li>
          );
        })}
      </ul>

      <Comparativa paquetes={data} />

      {/* Las acciones que no son «destacar»: ocupaban media tarjeta y compiten
          con lo único que hay que leer, que es el precio. */}
      <Hoja
        abierta={acciones !== null}
        onCerrar={() => setAcciones(null)}
        titulo={acciones?.name ?? ''}
        descripcion="Qué hacer con este paquete"
      >
        {acciones && (
          <ul className="flex flex-col gap-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <FilaAccion
              Icono={acciones.isActive ? EyeOff : Eye}
              etiqueta={`${acciones.isActive ? 'Ocultar' : 'Mostrar'} ${acciones.name}`}
              onClick={() => {
                alternarActivo(acciones);
                setAcciones(null);
              }}
            />
            <FilaAccion
              Icono={Pencil}
              etiqueta="Editar"
              onClick={() => {
                setEditando(acciones);
                setAcciones(null);
              }}
            />
            <FilaAccion
              Icono={Trash2}
              peligro
              etiqueta="Borrar"
              onClick={() => {
                pedirBorrado(acciones);
                setAcciones(null);
              }}
            />
          </ul>
        )}
      </Hoja>

      <Hoja
        abierta={ocultando !== null}
        onCerrar={() => setOcultando(null)}
        titulo={ocultando ? `Ocultar «${ocultando.name}»` : 'Ocultar'}
        descripcion="Es el paquete destacado. Si lo ocultas, la web no destacará ninguno: la sección sale plana."
      >
        {ocultando && (
          <div className="flex gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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

/** Fila de la hoja de acciones. 44px, icono a la izquierda y texto completo. */
function FilaAccion({
  Icono,
  etiqueta,
  onClick,
  peligro,
}: {
  Icono: typeof Star;
  etiqueta: string;
  onClick: () => void;
  peligro?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'hover:bg-card-hover rounded-control flex min-h-12 w-full items-center gap-3 px-3 text-left transition-colors duration-150',
          peligro ? 'text-danger' : 'text-bone',
        )}
      >
        <Icono
          className={cn('size-4 shrink-0', peligro ? 'text-danger' : 'text-brass')}
          aria-hidden
        />
        {etiqueta}
      </button>
    </li>
  );
}

/**
 * El único dato de negocio de esta pantalla: si un paquete no recibe clics, o no
 * se ve o el precio asusta. Se dice sin ventana temporal porque
 * `whatsappClickCount` es el acumulado DESDE SIEMPRE — poner «últimos 30 días»
 * sería inventarse un dato que la API no da.
 *
 * Solo aparece cuando hay señal de verdad: al menos diez clics repartidos y un
 * paquete por debajo de un tercio del mejor. Con menos, la diferencia es ruido y
 * un aviso permanente enseña a ignorarlo.
 */
function Comparativa({ paquetes }: { paquetes: AdminPackageDto[] }) {
  const activos = paquetes.filter((p) => p.isActive);
  if (activos.length < 2) return null;

  const total = activos.reduce((n, p) => n + p.whatsappClickCount, 0);
  if (total < 10) return null;

  const mejor = activos.reduce((a, b) => (b.whatsappClickCount > a.whatsappClickCount ? b : a));
  const peor = activos.reduce((a, b) => (b.whatsappClickCount < a.whatsappClickCount ? b : a));
  if (peor.id === mejor.id || peor.whatsappClickCount > mejor.whatsappClickCount / 3) return null;

  return (
    <p className="border-line bg-card text-ash rounded-card flex items-start gap-2.5 border p-3 text-sm">
      <Info className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        El {peor.name} lleva {peor.whatsappClickCount} clics contra {mejor.whatsappClickCount} del{' '}
        {mejor.name}. O no se ve, o el precio asusta.
      </span>
    </p>
  );
}
