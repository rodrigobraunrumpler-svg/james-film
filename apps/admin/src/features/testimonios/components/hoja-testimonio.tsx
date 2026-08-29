'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminTestimonialDto } from '@james-film/contracts';
import { useState } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { CampoImagen } from '@/components/shared/campo-imagen';
import { clasesBoton } from '@/components/shared/boton';
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
          <label htmlFor="authorName" className="text-muted text-xs">
            Nombre
          </label>
          <input id="authorName" {...register('authorName')} className="campo border-line" />
          {errores.authorName && (
            <p role="alert" className="text-danger text-sm">
              {errores.authorName.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="authorHandle" className="text-muted text-xs">
            Usuario
          </label>
          <input
            id="authorHandle"
            placeholder="@ana"
            {...register('authorHandle')}
            className="campo border-line"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="format" className="text-muted text-xs">
            Formato
          </label>
          <select id="format" {...register('format')} className="campo border-line">
            <option value="SCREENSHOT">Captura</option>
            <option value="TEXT">Texto</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="source" className="text-muted text-xs">
            De dónde viene
          </label>
          <select id="source" {...register('source')} className="campo border-line">
            <option value="WHATSAPP">WhatsApp</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="DIRECTO">En persona</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="eventType" className="text-muted text-xs">
            Tipo de evento
          </label>
          <input
            id="eventType"
            placeholder="Boda"
            {...register('eventType')}
            className="campo border-line"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="eventDate" className="text-muted text-xs">
            Fecha del evento
          </label>
          <input
            id="eventDate"
            type="date"
            {...register('eventDate')}
            className="campo border-line"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quote" className="text-muted text-xs">
          Lo que dijo
        </label>
        <textarea
          id="quote"
          rows={3}
          {...register('quote')}
          className="campo border-line min-h-0 px-2.5 py-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rating" className="text-muted text-xs">
            Estrellas
          </label>
          <select id="rating" {...register('rating')} className="campo border-line">
            <option value="">Sin valoración</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="externalUrl" className="text-muted text-xs">
            Enlace original
          </label>
          <input id="externalUrl" {...register('externalUrl')} className="campo border-line" />
          {errores.externalUrl && (
            <p role="alert" className="text-danger text-sm">
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

      {/* Pegado abajo, como la cabecera arriba: con un formulario largo,
          Guardar quedaba a un scroll entero de distancia. */}
      <div className="bg-chrome border-line sticky bottom-0 -mx-4 -mb-[calc(1.5rem+env(safe-area-inset-bottom))] flex gap-2 border-t px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={onCerrar} className={clasesBoton('secundario', 'flex-1')}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className={clasesBoton('principal', 'flex-1')}
        >
          {formState.isSubmitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
