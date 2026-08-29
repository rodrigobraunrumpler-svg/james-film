'use client';

import type { AdminTestimonialDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Lock, MessageSquareQuote, Plus, Star } from 'lucide-react';
import { Boton, clasesBoton } from '@/components/shared/boton';
import { ConfirmarBorrado } from '@/components/shared/confirmar-borrado';
import { EstadoVacio } from '@/components/shared/estado-vacio';
import { Hoja } from '@/components/shared/hoja';
import { esApiError } from '@/lib/api/errors';
import { fecha } from '@/lib/format';
import { ocultarSiFalla } from '@/lib/imagen';
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

const ETIQUETA: Record<EstadoFiltro, string> = {
  todos: 'Todos',
  publicados: 'Publicados',
  borradores: 'Borradores',
  'sin-consentimiento': 'Sin consentimiento',
};

const cumple = (t: AdminTestimonialDto, estado: EstadoFiltro): boolean => {
  if (estado === 'publicados') return t.isActive;
  if (estado === 'borradores') return !t.isActive && t.hasConsent;
  if (estado === 'sin-consentimiento') return !t.hasConsent;
  return true;
};

/** Icono cuadrado de la tarjeta: 44px en táctil, 30 en escritorio. */
const ICONO =
  'flex size-11 shrink-0 items-center justify-center rounded-control border border-line-strong bg-card text-bone transition-colors duration-150 hover:border-line-hover disabled:opacity-35 lg:size-[30px]';

export function ListaTestimonios() {
  const { data, isPending, isError, refetch } = useTestimonios();
  const { estado, setEstado } = useFiltroTestimonios();
  const { reordenar, fallo } = useOrdenTestimonios();
  const guardar = useGuardarTestimonio();
  const destacar = useDestacarTestimonio();
  const borrar = useBorrarTestimonio();
  const [editando, setEditando] = useState<AdminTestimonialDto | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<AdminTestimonialDto | null>(null);

  if (isPending) return <SkeletonTestimonios />;

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="font-medium">No se pudieron cargar los testimonios</p>
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
    // Confirmación que dice QUÉ SE ESTÁ AFIRMANDO, no un «¿seguro?».
    const seguro = confirm(
      `Vas a confirmar que ${t.authorName} te dio permiso para publicar su nombre, su foto y ` +
        `su mensaje en la web. ¿Es así?`,
    );
    if (seguro) guardar.mutate({ id: t.id, datos: { hasConsent: true } });
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Testimonios</h1>
          <p className="text-ash text-sm">
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
      <div className="border-line flex items-center gap-5 overflow-x-auto border-b" role="tablist">
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
                '-mb-px flex h-11 shrink-0 items-center gap-1.75 border-b-2 transition-colors duration-150 lg:h-10',
                seleccionada
                  ? 'border-brass text-bone font-medium'
                  : 'text-ash hover:text-bone border-transparent',
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
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((t, i) => (
            <li
              key={t.id}
              className={cn(
                'rounded-card flex flex-col overflow-hidden border transition-colors duration-150',
                // El sin consentimiento se distingue por el CONTINENTE, no por
                // una etiqueta más: es lo que no se puede publicar (§19).
                !t.hasConsent
                  ? 'border-danger-line bg-danger-bg'
                  : t.isFeatured
                    ? 'border-brass bg-card'
                    : 'border-line bg-card hover:border-line-hover',
              )}
            >
              <div className="flex min-w-0 items-center gap-3 p-3.5 pb-3">
                <span className="bg-active border-line-strong size-9 shrink-0 overflow-hidden rounded-full border">
                  {t.avatarUrl ? (
                    <img
                      src={t.avatarUrl}
                      alt=""
                      loading="lazy"
                      onError={ocultarSiFalla}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-brass flex h-full w-full items-center justify-center text-sm">
                      {t.authorName.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="dato font-medium">{t.authorName}</span>
                  <span className="text-ash truncate text-sm">
                    {t.eventType ?? t.source}
                    {t.eventDate ? ` · ${fecha(t.eventDate)}` : ''}
                  </span>
                </div>

                <Estado testimonio={t} />
              </div>

              {t.screenshotUrl && (
                <div className="bg-well border-line relative mx-3.5 max-h-44 overflow-hidden rounded-[6px] border">
                  <img
                    src={t.screenshotUrl}
                    alt=""
                    loading="lazy"
                    onError={ocultarSiFalla}
                    className={cn(
                      'aspect-3/4 w-full object-cover object-top',
                      // Difuminada mientras no haya permiso: se ve que hay algo,
                      // no se lee lo que dijo alguien que no ha dado el sí.
                      !t.hasConsent && 'blur-[6px]',
                    )}
                  />
                  {!t.hasConsent && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Lock className="text-danger size-5" aria-hidden />
                    </span>
                  )}
                </div>
              )}

              {t.quote && (
                <p className="text-ash dato line-clamp-3 px-3.5 pt-3 text-sm">«{t.quote}»</p>
              )}

              {!t.hasConsent && (
                // El motivo escrito, no un tooltip: es lo único que explica por
                // qué el botón de publicar no se puede pulsar.
                <p className="text-danger px-3.5 pt-3 text-xs">
                  No se puede publicar hasta que confirmes que {t.authorName} dio su permiso para
                  usar su nombre, su foto y su mensaje.
                </p>
              )}

              <div className="border-line mt-auto flex flex-wrap gap-1.5 border-t p-2.5 pt-3">
                <button
                  type="button"
                  aria-label={`Mover ${t.authorName} antes`}
                  disabled={i === 0 || hayFiltro}
                  onClick={() => reordenar(i, i - 1)}
                  className={ICONO}
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${t.authorName} después`}
                  disabled={i >= visibles.length - 1 || hayFiltro}
                  onClick={() => reordenar(i, i + 1)}
                  className={ICONO}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </button>
                <Boton onClick={() => marcarConsentimiento(t)}>
                  {t.hasConsent ? 'Quitar consentimiento' : 'Marcar consentimiento'}
                </Boton>
                <Boton
                  // Deshabilitado, no oculto: si desaparece, no se entiende por qué.
                  variante={t.hasConsent && !t.isActive ? 'principal' : 'secundario'}
                  disabled={!t.hasConsent}
                  onClick={() => publicar(t)}
                >
                  {t.isActive ? 'Despublicar' : 'Publicar'}
                </Boton>
                <label className="relative">
                  <input
                    type="radio"
                    name="destacado-testimonio"
                    checked={t.isFeatured}
                    onChange={() => destacar.mutate(t.id)}
                    aria-label={`Destacar ${t.authorName}`}
                    className="peer sr-only"
                  />
                  <span
                    className={clasesBoton(
                      'secundario',
                      'peer-checked:border-brass peer-checked:text-brass peer-focus-visible:outline-brass cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
                    )}
                  >
                    <Star className={cn('size-3.5', t.isFeatured && 'fill-current')} aria-hidden />
                    Destacar
                  </span>
                </label>
                <Boton onClick={() => setEditando(t)}>Editar</Boton>
                <Boton variante="peligro" onClick={() => setBorrando(t)}>
                  Borrar
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

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
function Estado({ testimonio: t }: { testimonio: AdminTestimonialDto }) {
  if (!t.hasConsent) {
    return (
      <span className="text-danger bg-danger-line/30 shrink-0 rounded px-1.5 py-0.5 text-[10px]">
        Sin permiso
      </span>
    );
  }
  if (t.isActive) {
    return (
      <span className="text-brass border-brass/40 shrink-0 rounded border px-1.5 py-0.5 text-[10px]">
        Publicado
      </span>
    );
  }
  return (
    <span className="text-ash bg-active shrink-0 rounded px-1.5 py-0.5 text-[10px]">Borrador</span>
  );
}

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
