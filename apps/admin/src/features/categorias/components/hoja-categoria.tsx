'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminCategoryDto } from '@james-film/contracts';
import { useState } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { CampoImagen } from '@/components/shared/campo-imagen';
import { esApiError } from '@/lib/api/errors';
import { limpiar } from '@/lib/forms/limpiar';
import { useGuardarCategoria } from '../hooks/use-categorias';
import { esquemaCategoria, type DatosFormularioCategoria } from '../schemas/categoria-schema';

const sugerirSlug = (nombre: string): string =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function HojaCategoria({
  categoria,
  onCerrar,
}: {
  categoria: AdminCategoryDto | null;
  onCerrar: () => void;
}) {
  const esNueva = categoria === null;
  const guardar = useGuardarCategoria();
  const [coverKey, setCoverKey] = useState<string | null | undefined>(undefined);
  const [editandoSlug, setEditandoSlug] = useState(false);

  const form = useForm<DatosFormularioCategoria>({
    resolver: zodResolver(esquemaCategoria),
    defaultValues: {
      name: categoria?.name ?? '',
      slug: categoria?.slug ?? '',
      tagline: categoria?.tagline ?? '',
      description: categoria?.description ?? '',
      metaTitle: categoria?.metaTitle ?? '',
      metaDescription: categoria?.metaDescription ?? '',
    },
  });
  const { register, handleSubmit, setError, setValue, watch, formState } = form;
  const errores = formState.errors;

  const enviar = handleSubmit(async (datos) => {
    try {
      await guardar.mutateAsync({
        id: categoria?.id,
        datos: {
          ...limpiar({
            tagline: datos.tagline,
            description: datos.description,
            metaTitle: datos.metaTitle,
            metaDescription: datos.metaDescription,
          }),
          name: datos.name.trim(),
          // El slug solo viaja si se editó: mandarlo siempre lo reescribiría
          // con el sugerido y rompería los enlaces compartidos.
          ...(editandoSlug && !esNueva ? { slug: datos.slug } : {}),
          // `undefined` NO TOCA la portada; `null` la borra.
          ...(coverKey !== undefined ? { coverKey } : {}),
        },
      });
      toast.success(esNueva ? 'Categoría creada' : 'Categoría guardada');
      onCerrar();
    } catch (e) {
      if (esApiError(e) && e.isValidation && e.details) {
        for (const d of e.details) {
          setError(d.field as Path<DatosFormularioCategoria>, { message: d.message });
        }
        return;
      }
      toast.error('No se pudo guardar. Inténtalo otra vez.');
    }
  });

  const nombre = watch('name');

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="name"
          {...register('name', {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              // Solo al CREAR: en una categoría existente el slug es un enlace
              // que ya está circulando por WhatsApp.
              if (esNueva) setValue('slug', sugerirSlug(e.target.value));
            },
          })}
          aria-invalid={Boolean(errores.name)}
          className="min-h-11 rounded-md border px-3"
        />
        {errores.name && (
          <p role="alert" className="text-sm text-red-600">
            {errores.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Enlace</span>
        {!editandoSlug ? (
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm [overflow-wrap:anywhere] text-neutral-600">
              /galerias/{watch('slug') || sugerirSlug(nombre || '')}
            </span>
            {!esNueva && (
              <button
                type="button"
                onClick={() => setEditandoSlug(true)}
                className="min-h-11 shrink-0 rounded-md border px-3 text-sm"
              >
                Editar
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              id="slug"
              {...register('slug')}
              aria-invalid={Boolean(errores.slug)}
              className="min-h-11 rounded-md border px-3"
            />
            {/* El aviso, no un tooltip: cambiarlo rompe cada enlace que James
                ya compartió, y no hay forma de enterarse después. */}
            <p className="text-xs text-amber-700">
              Si lo cambias, los enlaces que ya hayas compartido dejarán de funcionar.
            </p>
            {errores.slug && (
              <p role="alert" className="text-sm text-red-600">
                {errores.slug.message}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tagline" className="text-sm font-medium">
          Frase corta
        </label>
        <input id="tagline" {...register('tagline')} className="min-h-11 rounded-md border px-3" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className="rounded-md border p-3"
        />
      </div>

      <CampoImagen
        etiqueta="Portada"
        proposito="PORTADA_CATEGORIA"
        valorUrl={categoria?.coverUrl}
        onChange={setCoverKey}
        proporcion="16 / 9"
        ayuda="Se usa en la landing como cabecera de la categoría."
      />

      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">SEO</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="metaTitle" className="text-sm">
              Título en Google
            </label>
            <input
              id="metaTitle"
              {...register('metaTitle')}
              className="min-h-11 rounded-md border px-3"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="metaDescription" className="text-sm">
              Descripción en Google
            </label>
            <textarea
              id="metaDescription"
              rows={2}
              {...register('metaDescription')}
              className="rounded-md border p-3"
            />
          </div>
        </div>
      </details>

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
          {/* Lo pendiente va DENTRO del botón, nunca en un overlay. */}
          {formState.isSubmitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
