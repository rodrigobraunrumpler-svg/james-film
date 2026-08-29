'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminTestimonialDto } from '@james-film/contracts';
import { useState } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { CampoImagen } from '@/components/shared/campo-imagen';
import { esApiError } from '@/lib/api/errors';
import { limpiar } from '@/lib/forms/limpiar';
import { useGuardarTestimonio } from '../hooks/use-testimonios';
import { esquemaTestimonio, type DatosFormularioTestimonio } from '../schemas/testimonio-schema';

export function HojaTestimonio({
  testimonio,
  onCerrar,
}: {
  testimonio: AdminTestimonialDto | null;
  onCerrar: () => void;
}) {
  const esNuevo = testimonio === null;
  const guardar = useGuardarTestimonio();
  const [avatarKey, setAvatarKey] = useState<string | null | undefined>(undefined);
  const [screenshotKey, setScreenshotKey] = useState<string | null | undefined>(undefined);

  const form = useForm<DatosFormularioTestimonio>({
    resolver: zodResolver(esquemaTestimonio),
    defaultValues: {
      authorName: testimonio?.authorName ?? '',
      format: testimonio?.format ?? 'SCREENSHOT',
      source: testimonio?.source ?? 'WHATSAPP',
      authorHandle: testimonio?.authorHandle ?? '',
      eventType: testimonio?.eventType ?? '',
      eventDate: testimonio?.eventDate ?? '',
      quote: testimonio?.quote ?? '',
      externalUrl: testimonio?.externalUrl ?? '',
      rating: (testimonio?.rating?.toString() ?? '') as DatosFormularioTestimonio['rating'],
    },
  });
  const { register, handleSubmit, setError, formState, watch } = form;
  const errores = formState.errors;
  const formato = watch('format');

  const enviar = handleSubmit(async (datos) => {
    try {
      await guardar.mutateAsync({
        id: testimonio?.id,
        datos: {
          ...limpiar({
            authorHandle: datos.authorHandle,
            eventType: datos.eventType,
            eventDate: datos.eventDate,
            quote: datos.quote,
            externalUrl: datos.externalUrl,
          }),
          authorName: datos.authorName.trim(),
          format: datos.format,
          source: datos.source,
          rating: datos.rating ? Number(datos.rating) : null,
          ...(avatarKey !== undefined ? { avatarKey } : {}),
          ...(screenshotKey !== undefined ? { screenshotKey } : {}),
        },
      });
      // El consentimiento y la publicación NO se tocan aquí: son decisiones
      // aparte, con su propia confirmación en la lista.
      toast.success(esNuevo ? 'Testimonio creado como borrador' : 'Testimonio guardado');
      onCerrar();
    } catch (e) {
      if (esApiError(e) && e.isValidation && e.details) {
        for (const d of e.details) {
          setError(d.field as Path<DatosFormularioTestimonio>, { message: d.message });
        }
        return;
      }
      toast.error(esApiError(e) ? e.message : 'No se pudo guardar.');
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="authorName" className="text-sm font-medium">
            Nombre
          </label>
          <input
            id="authorName"
            {...register('authorName')}
            className="min-h-11 rounded-md border px-3"
          />
          {errores.authorName && (
            <p role="alert" className="text-sm text-red-600">
              {errores.authorName.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="authorHandle" className="text-sm font-medium">
            Usuario
          </label>
          <input
            id="authorHandle"
            placeholder="@ana"
            {...register('authorHandle')}
            className="min-h-11 rounded-md border px-3"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="format" className="text-sm font-medium">
            Formato
          </label>
          <select id="format" {...register('format')} className="min-h-11 rounded-md border px-3">
            <option value="SCREENSHOT">Captura</option>
            <option value="TEXT">Texto</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="source" className="text-sm font-medium">
            De dónde viene
          </label>
          <select id="source" {...register('source')} className="min-h-11 rounded-md border px-3">
            <option value="WHATSAPP">WhatsApp</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="DIRECTO">En persona</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="eventType" className="text-sm font-medium">
            Tipo de evento
          </label>
          <input
            id="eventType"
            placeholder="Boda"
            {...register('eventType')}
            className="min-h-11 rounded-md border px-3"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="eventDate" className="text-sm font-medium">
            Fecha del evento
          </label>
          <input
            id="eventDate"
            type="date"
            {...register('eventDate')}
            className="min-h-11 rounded-md border px-3"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quote" className="text-sm font-medium">
          Lo que dijo
        </label>
        <textarea id="quote" rows={3} {...register('quote')} className="rounded-md border p-3" />
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rating" className="text-sm font-medium">
            Estrellas
          </label>
          <select id="rating" {...register('rating')} className="min-h-11 rounded-md border px-3">
            <option value="">Sin valoración</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="externalUrl" className="text-sm font-medium">
            Enlace original
          </label>
          <input
            id="externalUrl"
            {...register('externalUrl')}
            className="min-h-11 rounded-md border px-3"
          />
          {errores.externalUrl && (
            <p role="alert" className="text-sm text-red-600">
              {errores.externalUrl.message}
            </p>
          )}
        </div>
      </div>

      <CampoImagen
        etiqueta="Foto de la persona"
        proposito="AVATAR_TESTIMONIO"
        valorUrl={testimonio?.avatarUrl}
        onChange={setAvatarKey}
        proporcion="1 / 1"
      />

      {formato === 'SCREENSHOT' && (
        <CampoImagen
          etiqueta="Captura del mensaje"
          proposito="CAPTURA_TESTIMONIO"
          valorUrl={testimonio?.screenshotUrl}
          onChange={setScreenshotKey}
          proporcion="3 / 4"
          ayuda="Se borrará del servidor si eliminas el testimonio."
        />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-11 flex-1 rounded-md border px-4 font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="min-h-11 flex-1 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-60"
        >
          {formState.isSubmitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
