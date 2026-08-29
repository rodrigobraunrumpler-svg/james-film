'use client';

import type { AdminTestimonialDto } from '@james-film/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { MessageSquareQuote } from 'lucide-react';
import { ConfirmarBorrado } from '@/components/shared/confirmar-borrado';
import { EstadoVacio } from '@/components/shared/estado-vacio';
import { Hoja } from '@/components/shared/hoja';
import { esApiError } from '@/lib/api/errors';
import { fecha } from '@/lib/format';
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditando(null)}
          className="min-h-11 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
        >
          Nuevo testimonio
        </button>

        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={estado === e}
              onClick={() => void setEstado(e)}
              className={`min-h-11 rounded-md border px-3 text-sm ${
                estado === e ? 'bg-neutral-900 text-white' : ''
              }`}
            >
              {ETIQUETA[e]}
            </button>
          ))}
        </div>
      </div>

      {hayFiltro && (
        // ReorderService numera 0..n-1 SOLO los ids que recibe: reordenar una
        // lista filtrada mandaría un subconjunto y los que no se ven quedarían
        // con órdenes que colisionan. La lista pública saldría barajada, sin
        // ningún error.
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Quita el filtro para poder reordenar.
        </p>
      )}

      {fallo && (
        <p role="alert" className="text-sm text-red-600">
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
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-neutral-500">
          No hay testimonios con este filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((t, i) => (
            <li key={t.id} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="size-12 shrink-0 overflow-hidden rounded-full bg-neutral-100">
                  {t.avatarUrl && (
                    <img
                      src={t.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="[overflow-wrap:anywhere]">{t.authorName}</span>
                    {!t.hasConsent ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800">
                        Sin consentimiento
                      </span>
                    ) : t.isActive ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-800">
                        Publicado
                      </span>
                    ) : (
                      <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">
                        Borrador
                      </span>
                    )}
                    {t.isFeatured && (
                      <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        Destacado
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {t.eventType ?? t.source}
                    {t.eventDate ? ` · ${fecha(t.eventDate)}` : ''}
                  </span>
                  {t.quote && (
                    <p className="mt-1 line-clamp-2 text-sm [overflow-wrap:anywhere] text-neutral-600">
                      {t.quote}
                    </p>
                  )}
                </div>
              </div>

              {!t.hasConsent && (
                // El motivo escrito al lado, no un tooltip: es lo único que
                // explica por qué el botón de publicar no se puede pulsar.
                <p className="text-xs text-neutral-600">
                  No se puede publicar hasta que confirmes que {t.authorName} dio su permiso.
                </p>
              )}

              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  aria-label={`Mover ${t.authorName} antes`}
                  disabled={i === 0 || hayFiltro}
                  onClick={() => reordenar(i, i - 1)}
                  className="min-h-11 min-w-11 rounded-md border text-sm disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${t.authorName} después`}
                  disabled={i >= visibles.length - 1 || hayFiltro}
                  onClick={() => reordenar(i, i + 1)}
                  className="min-h-11 min-w-11 rounded-md border text-sm disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => marcarConsentimiento(t)}
                  className="min-h-11 rounded-md border px-3 text-sm"
                >
                  {t.hasConsent ? 'Quitar consentimiento' : 'Marcar consentimiento'}
                </button>
                <button
                  type="button"
                  // Deshabilitado, no oculto: si desaparece, no se entiende por qué.
                  disabled={!t.hasConsent}
                  onClick={() => publicar(t)}
                  className="min-h-11 rounded-md border px-3 text-sm disabled:opacity-40"
                >
                  {t.isActive ? 'Despublicar' : 'Publicar'}
                </button>
                <label className="flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm">
                  <input
                    type="radio"
                    name="destacado-testimonio"
                    checked={t.isFeatured}
                    onChange={() => destacar.mutate(t.id)}
                    aria-label={`Destacar ${t.authorName}`}
                  />
                  Destacar
                </label>
                <button
                  type="button"
                  onClick={() => setEditando(t)}
                  className="min-h-11 rounded-md border px-3 text-sm"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setBorrando(t)}
                  className="min-h-11 rounded-md border px-3 text-sm"
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {borrando && (
        <ConfirmarBorrado
          nombre={borrando.authorName}
          descripcion="También se borrarán del servidor su captura y su foto. No se puede deshacer."
          cargando={borrar.isPending}
          onCancelar={() => setBorrando(null)}
          onConfirmar={() => void confirmarBorrado(borrando)}
        />
      )}

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

export function SkeletonTestimonios() {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex items-start gap-3 rounded-lg border p-3">
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-neutral-200" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-full animate-pulse rounded bg-neutral-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
