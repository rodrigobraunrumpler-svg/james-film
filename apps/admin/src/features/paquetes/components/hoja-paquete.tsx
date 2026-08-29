'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminCategoryDto, AdminPackageDto } from '@james-film/contracts';
import { useState } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { CampoImagen } from '@/components/shared/campo-imagen';
import { esApiError } from '@/lib/api/errors';
import { aCentimos, aSoles } from '@/lib/format';
import { limpiar } from '@/lib/forms/limpiar';
import { useGuardarPaquete, useIconos } from '../hooks/use-paquetes';
import { esquemaPaquete, type DatosFormularioPaquete } from '../schemas/paquete-schema';
import { CamposBullets } from './campos-bullets';

export function HojaPaquete({
  paquete,
  categorias,
  onCerrar,
}: {
  paquete: AdminPackageDto | null;
  categorias: AdminCategoryDto[];
  onCerrar: () => void;
}) {
  const esNuevo = paquete === null;
  const guardar = useGuardarPaquete();
  const { data: iconosDisponibles } = useIconos();
  const [imageKey, setImageKey] = useState<string | null | undefined>(undefined);

  const form = useForm<DatosFormularioPaquete>({
    resolver: zodResolver(esquemaPaquete),
    defaultValues: {
      name: paquete?.name ?? '',
      subtitle: paquete?.subtitle ?? '',
      precioSoles: aSoles(paquete?.priceAmount)?.toString() ?? '',
      priceNote: paquete?.priceNote ?? '',
      idealFor: paquete?.idealFor ?? '',
      icon: paquete?.icon ?? '',
      badgeText: paquete?.badgeText ?? '',
      whatsappMessage: paquete?.whatsappMessage ?? '',
      items: paquete?.items.map((i) => ({ id: i.id, text: i.text, included: i.included })) ?? [],
      categoryIds: paquete?.categoryIds ?? [],
    },
  });
  const { register, handleSubmit, setError, formState, watch, setValue } = form;
  const errores = formState.errors;
  const seleccionadas = watch('categoryIds');

  const enviar = handleSubmit(async (datos) => {
    try {
      await guardar.mutateAsync({
        id: paquete?.id,
        datos: {
          ...limpiar({
            subtitle: datos.subtitle,
            priceNote: datos.priceNote,
            idealFor: datos.idealFor,
            icon: datos.icon,
            badgeText: datos.badgeText,
            whatsappMessage: datos.whatsappMessage,
          }),
          name: datos.name.trim(),
          // Céntimos, y la conversión en un solo sitio.
          priceAmount: datos.precioSoles ? aCentimos(Number(datos.precioSoles)) : null,
          // El array COMPLETO y en orden: el servidor crea, actualiza y borra
          // según lo que llega.
          items: datos.items.map((i) => ({ id: i.id, text: i.text, included: i.included })),
          categoryIds: datos.categoryIds,
          ...(imageKey !== undefined ? { imageKey } : {}),
        },
      });
      toast.success(esNuevo ? 'Paquete creado' : 'Paquete guardado');
      onCerrar();
    } catch (e) {
      if (esApiError(e) && e.isValidation && e.details) {
        for (const d of e.details) {
          setError(d.field as Path<DatosFormularioPaquete>, { message: d.message });
        }
        return;
      }
      toast.error(esApiError(e) ? e.message : 'No se pudo guardar.');
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Nombre
        </label>
        <input id="name" {...register('name')} className="min-h-11 rounded-md border px-3" />
        {errores.name && (
          <p role="alert" className="text-sm text-red-600">
            {errores.name.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="precioSoles" className="text-sm font-medium">
            Precio en soles
          </label>
          <input
            id="precioSoles"
            type="number"
            // Enteros: en la base van céntimos y S/ 300 son 30000.
            step="1"
            min="0"
            inputMode="numeric"
            {...register('precioSoles')}
            className="min-h-11 rounded-md border px-3"
          />
          {errores.precioSoles && (
            <p role="alert" className="text-sm text-red-600">
              {errores.precioSoles.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="priceNote" className="text-sm font-medium">
            Nota del precio
          </label>
          <input
            id="priceNote"
            placeholder="desde"
            {...register('priceNote')}
            className="min-h-11 rounded-md border px-3"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subtitle" className="text-sm font-medium">
            Subtítulo
          </label>
          <input
            id="subtitle"
            {...register('subtitle')}
            className="min-h-11 rounded-md border px-3"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="icon" className="text-sm font-medium">
            Ícono
          </label>
          {/* Lista cerrada que da la API: la misma contra la que valida. */}
          <select id="icon" {...register('icon')} className="min-h-11 rounded-md border px-3">
            <option value="">Ninguno</option>
            {(iconosDisponibles ?? []).map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="idealFor" className="text-sm font-medium">
          Ideal para
        </label>
        <input
          id="idealFor"
          {...register('idealFor')}
          className="min-h-11 rounded-md border px-3"
        />
      </div>

      <CamposBullets form={form} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Categorías</legend>
        <div className="flex flex-wrap gap-3">
          {categorias.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={seleccionadas.includes(c.id)}
                onChange={(e) =>
                  setValue(
                    'categoryIds',
                    e.target.checked
                      ? [...seleccionadas, c.id]
                      : seleccionadas.filter((id) => id !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="badgeText" className="text-sm font-medium">
            Etiqueta
          </label>
          <input
            id="badgeText"
            placeholder="NUESTRO MÁS VENDIDO"
            {...register('badgeText')}
            className="min-h-11 rounded-md border px-3"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="whatsappMessage" className="text-sm font-medium">
            Mensaje de WhatsApp
          </label>
          <input
            id="whatsappMessage"
            {...register('whatsappMessage')}
            className="min-h-11 rounded-md border px-3"
          />
        </div>
      </div>

      <CampoImagen
        etiqueta="Imagen de fondo"
        proposito="IMAGEN_PAQUETE"
        valorUrl={paquete?.imageUrl}
        onChange={setImageKey}
        proporcion="4 / 3"
      />

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
