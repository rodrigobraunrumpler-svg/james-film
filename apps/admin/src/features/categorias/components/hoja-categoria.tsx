'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminCategoryDto } from '@james-film/contracts';
import { useState } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { CampoImagen } from '@/components/shared/campo-imagen';
import { clasesBoton } from '@/components/shared/boton';
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
        <label htmlFor="name" className="text-muted text-xs">
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
          className="campo border-line"
        />
        {errores.name && (
          <p role="alert" className="text-danger text-sm">
            {errores.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-muted text-xs">Enlace</span>
        {!editandoSlug ? (
          <div className="flex items-center gap-2">
            <span className="dato text-ash min-w-0 flex-1 truncate text-sm">
              /galerias/{watch('slug') || sugerirSlug(nombre || '')}
            </span>
            {!esNueva && (
              <button
                type="button"
                onClick={() => setEditandoSlug(true)}
                className={clasesBoton('secundario', 'shrink-0')}
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
              className="campo border-line"
            />
            {/* El aviso, no un tooltip: cambiarlo rompe cada enlace que James
                ya compartió, y no hay forma de enterarse después. */}
            <p className="text-brass text-xs">
              Si lo cambias, los enlaces que ya hayas compartido dejarán de funcionar.
            </p>
            {errores.slug && (
              <p role="alert" className="text-danger text-sm">
                {errores.slug.message}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tagline" className="text-muted text-xs">
          Frase corta
        </label>
        <input id="tagline" {...register('tagline')} className="campo border-line" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-muted text-xs">
          Descripción
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className="campo border-line min-h-0 px-2.5 py-2"
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

      <details className="campo border-line min-h-0 px-2.5 py-2">
        <summary className="cursor-pointer text-sm font-medium">SEO</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="metaTitle" className="text-sm">
              Título en Google
            </label>
            <input id="metaTitle" {...register('metaTitle')} className="campo border-line" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="metaDescription" className="text-sm">
              Descripción en Google
            </label>
            <textarea
              id="metaDescription"
              rows={2}
              {...register('metaDescription')}
              className="campo border-line min-h-0 px-2.5 py-2"
            />
          </div>
        </div>
      </details>

      {/* Pegado abajo, como la cabecera arriba: con un formulario largo,
          Guardar quedaba a un scroll entero de distancia. */}
      <div className="bg-chrome border-line sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={onCerrar} className={clasesBoton('secundario', 'flex-1')}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className={clasesBoton('principal', 'flex-1')}
        >
          {/* Lo pendiente va DENTRO del botón, nunca en un overlay. */}
          {formState.isSubmitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
