'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminGalleryDto, CategoryRefDto } from '@james-film/contracts';
import { useForm, type Path } from 'react-hook-form';
import { esApiError } from '@/lib/api/errors';
import { useAutoguardado } from '../hooks/use-autoguardado';
import { useActualizarGaleria } from '../hooks/use-galeria';
import { esquemaGaleria, type DatosFormularioGaleria } from '../schemas/galeria-schema';
import type { DatosGaleria } from '../services/galerias';
import { EstadoGuardado } from './estado-guardado';

const valoresDe = (g: AdminGalleryDto): DatosFormularioGaleria => ({
  title: g.title,
  description: g.description ?? '',
  categoryId: g.category.id,
  // `@db.Date` ya llega como YYYY-MM-DD, que es justo lo que come el input.
  eventDate: g.eventDate ?? '',
  location: g.location ?? '',
});

/**
 * La cadena vacía se manda como `null`, no se omite: omitirla dejaría el valor
 * viejo en la base y James no podría BORRAR una descripción, solo cambiarla.
 */
const aPayload = (d: DatosFormularioGaleria): DatosGaleria => ({
  title: d.title.trim(),
  description: d.description?.trim() || null,
  categoryId: d.categoryId,
  eventDate: d.eventDate || null,
  location: d.location?.trim() || null,
});

export function FormularioGaleria({
  galeria,
  categorias,
}: {
  galeria: AdminGalleryDto;
  categorias: CategoryRefDto[];
}) {
  const actualizar = useActualizarGaleria(galeria.id);

  const form = useForm<DatosFormularioGaleria>({
    resolver: zodResolver(esquemaGaleria),
    defaultValues: valoresDe(galeria),
    // El autoguardado solo dispara si el formulario es válido, así que `isValid`
    // tiene que estar al día en cada pulsación.
    mode: 'onChange',
  });
  const { register, setError, formState } = form;

  const { estado, guardadoEn } = useAutoguardado(form, async (datos) => {
    try {
      await actualizar.mutateAsync(aPayload(datos));
    } catch (e) {
      // El servidor manda `details[].field` con rutas con puntos ya listas:
      // setError sin parsear nada. Si el error no es de validación se relanza
      // tal cual y la línea de estado lo cuenta.
      if (esApiError(e) && e.isValidation && e.details) {
        for (const d of e.details) {
          setError(d.field as Path<DatosFormularioGaleria>, { message: d.message });
        }
      }
      throw e;
    }
  });

  const errores = formState.errors;

  return (
    // Sin <form>: no hay submit. El guardado lo lleva el debounce, y un Enter
    // que recargue la página en mitad de una subida sería el peor final posible.
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Título
        </label>
        <input
          id="title"
          {...register('title')}
          aria-invalid={Boolean(errores.title)}
          aria-describedby={errores.title ? 'title-error' : undefined}
          className="min-h-11 rounded-md border px-3"
        />
        {errores.title && (
          <p id="title-error" role="alert" className="text-sm text-red-600">
            {errores.title.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-sm font-medium">
          Categoría
        </label>
        <select
          id="categoryId"
          {...register('categoryId')}
          aria-invalid={Boolean(errores.categoryId)}
          className="min-h-11 rounded-md border px-3"
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errores.categoryId && (
          <p role="alert" className="text-sm text-red-600">
            {errores.categoryId.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="eventDate" className="text-sm font-medium">
            Fecha del evento
          </label>
          {/* Nativo: en el iPhone abre el selector de iOS y no hace falta librería. */}
          <input
            id="eventDate"
            type="date"
            {...register('eventDate')}
            aria-invalid={Boolean(errores.eventDate)}
            className="min-h-11 rounded-md border px-3"
          />
          {errores.eventDate && (
            <p role="alert" className="text-sm text-red-600">
              {errores.eventDate.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="location" className="text-sm font-medium">
            Lugar
          </label>
          <input
            id="location"
            {...register('location')}
            placeholder="Ayacucho"
            className="min-h-11 rounded-md border px-3"
          />
          {errores.location && (
            <p role="alert" className="text-sm text-red-600">
              {errores.location.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="description"
          rows={4}
          {...register('description')}
          className="rounded-md border p-3"
        />
        {errores.description && (
          <p role="alert" className="text-sm text-red-600">
            {errores.description.message}
          </p>
        )}
      </div>

      <EstadoGuardado estado={estado} guardadoEn={guardadoEn} />
    </div>
  );
}
