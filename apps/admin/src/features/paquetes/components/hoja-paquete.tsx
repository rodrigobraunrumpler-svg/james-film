'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminCategoryDto, AdminPackageDto } from '@james-film/contracts';
import { useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { CampoImagen } from '@/components/shared/campo-imagen';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { clasesBoton } from '@/components/shared/boton';
import { SelectorIcono } from '@/components/shared/selector-icono';
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
  const { register, handleSubmit, setError, formState, watch, setValue, control } = form;
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
        <label htmlFor="name" className="text-muted text-xs">
          Nombre
        </label>
        <input id="name" {...register('name')} className="campo border-line" />
        {errores.name && (
          <p role="alert" className="text-danger text-sm">
            {errores.name.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="precioSoles" className="text-muted text-xs">
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
            className="campo border-line"
          />
          {errores.precioSoles && (
            <p role="alert" className="text-danger text-sm">
              {errores.precioSoles.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="priceNote" className="text-muted text-xs">
            Nota del precio
          </label>
          <input
            id="priceNote"
            placeholder="desde"
            {...register('priceNote')}
            className="campo border-line"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subtitle" className="text-muted text-xs">
            Subtítulo
          </label>
          <input id="subtitle" {...register('subtitle')} className="campo border-line" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="icon" className="text-muted text-xs">
            Ícono
          </label>
          {/* Lista cerrada que da la API: la misma contra la que valida. */}
          <Controller
            control={control}
            name="icon"
            render={({ field }) => (
              <SelectorIcono
                id="icon"
                valor={field.value ?? ''}
                onCambiar={field.onChange}
                opciones={iconosDisponibles ?? []}
              />
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="idealFor" className="text-muted text-xs">
          Ideal para
        </label>
        <input id="idealFor" {...register('idealFor')} className="campo border-line" />
      </div>

      <CamposBullets form={form} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted text-xs">Categorías</legend>
        {/* Chips en vez de casillas nativas: el checkbox del sistema es azul y
            no se puede estilar, y con más de diez categorías una fila de ellos
            es una pared. El input sigue existiendo debajo —`sr-only`— así que
            teclado y lector de pantalla funcionan igual. */}
        <div className="flex flex-wrap gap-1.5">
          {categorias.map((c) => {
            const elegida = seleccionadas.includes(c.id);
            return (
              <label key={c.id} className="relative">
                <input
                  type="checkbox"
                  checked={elegida}
                  onChange={(e) =>
                    setValue(
                      'categoryIds',
                      e.target.checked
                        ? [...seleccionadas, c.id]
                        : seleccionadas.filter((id) => id !== c.id),
                    )
                  }
                  className="peer sr-only"
                />
                <span className="border-line-strong text-ash peer-checked:border-brass peer-checked:text-brass peer-checked:bg-brass/10 peer-focus-visible:outline-brass hover:border-line-hover rounded-control flex min-h-11 cursor-pointer items-center gap-1.5 border px-3 text-sm transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 lg:min-h-8">
                  <Check
                    className={cn(
                      'size-3.5 transition-opacity',
                      elegida ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  {c.name}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="badgeText" className="text-muted text-xs">
            Etiqueta
          </label>
          <input
            id="badgeText"
            placeholder="NUESTRO MÁS VENDIDO"
            {...register('badgeText')}
            className="campo border-line"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="whatsappMessage" className="text-muted text-xs">
            Mensaje de WhatsApp
          </label>
          <input
            id="whatsappMessage"
            {...register('whatsappMessage')}
            className="campo border-line"
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
