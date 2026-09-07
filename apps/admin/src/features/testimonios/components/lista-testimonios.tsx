'use client';

import type { AdminTestimonialDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { MessageSquareQuote, Plus } from 'lucide-react';
import { Boton } from '@/components/shared/boton';
import { ConfirmarBorrado } from '@/components/shared/confirmar-borrado';
import { EstadoVacio } from '@/components/shared/estado-vacio';
import { LuzAmbiente } from '@/components/shared/luz-ambiente';
import { Hoja } from '@/components/shared/hoja';
import { esApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';
import {
  useBorrarTestimonio,
  useDestacarTestimonio,
  useGuardarTestimonio,
  useOrdenTestimonios,
  useTestimonios,
} from '../hooks/use-testimonios';
import { ESTADOS, useFiltroTestimonios, type EstadoFiltro } from '../hooks/use-filtro-testimonios';
import { HojaTestimonio } from './hoja-testimonio';
import { TarjetaTestimonio } from './tarjeta-testimonio';

const ETIQUETA: Record<EstadoFiltro, string> = {
  todos: 'Todos',
  publicados: 'Publicados',
  borradores: 'Borradores',
  'sin-consentimiento': 'Sin consentimiento',
};

/**
 * `auto-fill` y NO `auto-fit`: con un solo testimonio —que es lo normal al
 * empezar— `auto-fit` colapsa las columnas vacías y estira esa tarjeta a todo
 * el ancho, con la captura ocupando la pantalla entera. `auto-fill` conserva
 * las pistas y la tarjeta mantiene su tamaño.
 *
 * `min(260px, 100%)` en el `minmax`: sin el `min()`, a 320px de ancho la pista
 * de 260px más el padding desborda.
 */
/**
 * `items-start` es tan importante como el `auto-fill`: sin él la fila iguala
 * alturas y un testimonio sin captura se estira al alto del que sí la tiene.
 * Son 300px de tarjeta vacía que se leen como un fallo de carga, no como un
 * testimonio corto.
 */
const REJILLA =
  'grid items-start grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3.5';

const cumple = (t: AdminTestimonialDto, estado: EstadoFiltro): boolean => {
  if (estado === 'publicados') return t.isActive;
  if (estado === 'borradores') return !t.isActive && t.hasConsent;
  if (estado === 'sin-consentimiento') return !t.hasConsent;
  return true;
};

export function ListaTestimonios() {
  const { data, isPending, isError, refetch } = useTestimonios();
  const { estado, setEstado } = useFiltroTestimonios();
  const { reordenar, fallo } = useOrdenTestimonios();
  const guardar = useGuardarTestimonio();
  const destacar = useDestacarTestimonio();
  const borrar = useBorrarTestimonio();
  const [editando, setEditando] = useState<AdminTestimonialDto | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<AdminTestimonialDto | null>(null);
  const [pidiendoConsentimiento, setPidiendoConsentimiento] = useState<AdminTestimonialDto | null>(
    null,
  );

  if (isPending) return <SkeletonTestimonios />;

  if (isError) {
    return (
      <div role="alert" className="border-danger-line flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="font-medium">No se pudieron cargar los testimonios</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="border-line-strong min-h-11 rounded-md border px-4 text-sm font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const hayFiltro = estado !== 'todos';
  const visibles = data.filter((t) => cumple(t, estado));

  const publicar = (t: AdminTestimonialDto): void => {
    if (!t.hasConsent) return;
    guardar.mutate({ id: t.id, datos: { isActive: !t.isActive } });
  };

  const marcarConsentimiento = (t: AdminTestimonialDto): void => {
    if (t.hasConsent) {
      guardar.mutate({ id: t.id, datos: { hasConsent: false, isActive: false } });
      return;
    }
    // En una `Hoja`, NUNCA con `confirm()`, y aquí menos que en ningún sitio:
    // es la afirmación que sostiene la Ley 29733 (§19), y en iOS el diálogo
    // nativo del SISTEMA se acepta con el pulgar sin leerlo — que es
    // exactamente el fallo del que esta confirmación tiene que proteger.
    setPidiendoConsentimiento(t);
  };

  /**
   * Borrado FUERTE, escribiendo el nombre: se lleva del servidor la captura y
   * la foto de una persona real, y no hay vuelta atrás. Es el mismo criterio
   * que la galería — el `confirm()` nativo se acepta con el pulgar sin leerlo.
   */
  const confirmarBorrado = async (t: AdminTestimonialDto): Promise<void> => {
    try {
      await borrar.mutateAsync(t.id);
      setBorrando(null);
      toast.success('Testimonio borrado');
    } catch (e) {
      toast.error(esApiError(e) ? e.message : 'No se pudo borrar.');
    }
  };

  return (
    <div className="relative flex flex-col gap-4">
      <LuzAmbiente className="-top-44 right-1/4 w-[620px]" />

      <div className="entra flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(19px,3.5vw,24px)] font-extrabold tracking-[-0.02em]">
            Testimonios
          </h1>
          <p className="text-ash mt-1 text-sm">
            Una captura de una clienta contenta vende más que cualquier texto.
          </p>
        </div>
        <Boton variante="principal" onClick={() => setEditando(null)}>
          <Plus className="size-3.5" aria-hidden />
          Nuevo testimonio
        </Boton>
      </div>

      {/* Pestañas con recuento. No hacen falta endpoints como en Galerías: allí
          la lista está PAGINADA y contar el trozo visible mentiría; aquí la API
          devuelve todos y el número sale del array que ya está en memoria. */}
      <div
        className="entra border-line sin-barra -mx-4 flex items-center gap-0.5 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0"
        style={{ '--i': 1 } as React.CSSProperties}
        role="tablist"
      >
        {ESTADOS.map((e) => {
          const seleccionada = estado === e;
          const cuantos = data.filter((t) => cumple(t, e)).length;
          return (
            <button
              key={e}
              type="button"
              role="tab"
              aria-selected={seleccionada}
              onClick={() => void setEstado(e)}
              className={cn(
                // El filo como `box-shadow` interior y no como `border`: un
                // borde de 2px solo en la activa mueve la fila entera al cambiar.
                'flex h-11 shrink-0 items-center gap-1.75 px-3.5 text-sm transition-colors duration-150 lg:h-8',
                seleccionada
                  ? 'text-bone font-medium shadow-[inset_0_-2px_0_var(--color-brass)]'
                  : 'text-ash hover:text-bone',
              )}
            >
              {ETIQUETA[e]}
              <span
                className={cn(
                  'text-sm tabular-nums',
                  // El de «sin consentimiento» en rojo aunque la pestaña no esté
                  // activa: es el único que pide una acción legal (§19).
                  e === 'sin-consentimiento' && cuantos > 0
                    ? 'text-danger'
                    : seleccionada
                      ? 'text-ash'
                      : 'text-muted',
                )}
              >
                {cuantos}
              </span>
            </button>
          );
        })}
      </div>

      {hayFiltro && (
        // ReorderService numera 0..n-1 SOLO los ids que recibe: reordenar una
        // lista filtrada mandaría un subconjunto y los que no se ven quedarían
        // con órdenes que colisionan. La lista pública saldría barajada, sin
        // ningún error.
        <p className="border-line-strong bg-card text-ash rounded-card border p-3 text-sm">
          Quita el filtro para poder reordenar.
        </p>
      )}

      {fallo && (
        <p role="alert" className="text-danger text-sm">
          No se pudo guardar el orden. Se ha dejado como estaba.
        </p>
      )}

      {data.length === 0 ? (
        <EstadoVacio
          Icono={MessageSquareQuote}
          titulo="Aún no tienes testimonios"
          explicacion="Una captura de un WhatsApp de una clienta contenta vende más que cualquier texto. Acuérdate de pedirle permiso antes de publicarlo."
          accion="Añadir el primero"
          onAccion={() => setEditando(null)}
        />
      ) : visibles.length === 0 ? (
        <p className="border-line-strong text-ash rounded-card border border-dashed p-6 text-center text-sm">
          No hay testimonios con este filtro.
        </p>
      ) : (
        <ul className={REJILLA}>
          {visibles.map((t, i) => (
            <li key={t.id} className="min-w-0">
              <TarjetaTestimonio
                testimonio={t}
                i={i + 2}
                acciones={{
                  indice: i,
                  total: visibles.length,
                  puedeMover: !hayFiltro,
                  onMover: reordenar,
                  onConsentimiento: () => marcarConsentimiento(t),
                  onPublicar: () => publicar(t),
                  onDestacar: () => destacar.mutate(t.id),
                  onEditar: () => setEditando(t),
                  onBorrar: () => setBorrando(t),
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* La confirmación dice QUÉ SE ESTÁ AFIRMANDO, no «¿seguro?»: lo que se
          confirma es un permiso de una persona real. */}
      <Hoja
        abierta={pidiendoConsentimiento !== null}
        onCerrar={() => setPidiendoConsentimiento(null)}
        titulo="¿Te dio permiso?"
        descripcion={
          pidiendoConsentimiento
            ? `Vas a confirmar que ${pidiendoConsentimiento.authorName} te dio permiso para publicar su nombre, su foto y su mensaje en la web.`
            : ''
        }
      >
        {pidiendoConsentimiento && (
          <div className="flex flex-col gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <p className="text-muted text-xs leading-relaxed">
              Lo dice la Ley 29733 de protección de datos. Sin este permiso el testimonio no puede
              publicarse, y en los XV años puede haber menores.
            </p>
            <div className="flex gap-2">
              <Boton className="flex-1" onClick={() => setPidiendoConsentimiento(null)}>
                Todavía no
              </Boton>
              <Boton
                variante="principal"
                className="flex-1"
                onClick={() => {
                  guardar.mutate({
                    id: pidiendoConsentimiento.id,
                    datos: { hasConsent: true },
                  });
                  setPidiendoConsentimiento(null);
                }}
              >
                Sí, me dio permiso
              </Boton>
            </div>
          </div>
        )}
      </Hoja>

      <Hoja
        abierta={borrando !== null}
        onCerrar={() => setBorrando(null)}
        titulo={borrando ? `Borrar «${borrando.authorName}»` : 'Borrar'}
        descripcion="Se borran también su captura y su foto del servidor."
      >
        {borrando && (
          <ConfirmarBorrado
            nombre={borrando.authorName}
            descripcion="También se borrarán del servidor su captura y su foto. No se puede deshacer."
            cargando={borrar.isPending}
            onCancelar={() => setBorrando(null)}
            onConfirmar={() => void confirmarBorrado(borrando)}
          />
        )}
      </Hoja>

      <Hoja
        abierta={editando !== undefined}
        onCerrar={() => setEditando(undefined)}
        titulo={editando ? `Editar ${editando.authorName}` : 'Nuevo testimonio'}
        descripcion="Se crea como borrador: publicarlo exige marcar el consentimiento aparte."
      >
        {editando !== undefined && (
          <HojaTestimonio testimonio={editando} onCerrar={() => setEditando(undefined)} />
        )}
      </Hoja>
    </div>
  );
}

/** El estado, en una pastilla. Tres valores excluyentes, nunca dos a la vez. */

export function SkeletonTestimonios() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="border-line bg-card rounded-card flex flex-col gap-3 border p-3.5">
          <div className="flex items-center gap-3">
            <div className="bg-active size-9 shrink-0 animate-pulse rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="bg-active h-3.5 w-1/2 animate-pulse rounded" />
              <div className="bg-line h-3 w-1/3 animate-pulse rounded" />
            </div>
          </div>
          <div className="bg-well aspect-3/4 max-h-44 animate-pulse rounded-[6px]" />
        </li>
      ))}
    </ul>
  );
}
