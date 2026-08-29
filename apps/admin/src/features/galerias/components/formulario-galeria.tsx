'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminGalleryDto, CategoryRefDto } from '@james-film/contracts';
import type { ReactNode } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { Boton } from '@/components/shared/boton';
import { CampoFecha } from '@/components/shared/campo-fecha';
import { Selector } from '@/components/shared/selector';
import { esApiError } from '@/lib/api/errors';
import { limpiar } from '@/lib/forms/limpiar';
import { useActualizarGaleria } from '../hooks/use-galeria';
import { esquemaGaleria, type DatosFormularioGaleria } from '../schemas/galeria-schema';
import type { DatosGaleria } from '../services/galerias';

const valoresDe = (g: AdminGalleryDto): DatosFormularioGaleria => ({
  title: g.title,
  description: g.description ?? '',
  categoryId: g.category.id,
  // `@db.Date` ya llega como YYYY-MM-DD, que es justo lo que come el input.
  eventDate: g.eventDate ?? '',
  location: g.location ?? '',
});

/**
 * `limpiar` compartido: la cadena vacía se manda como `null`, no se omite.
 * Omitirla dejaría el valor viejo en la base y James no podría BORRAR una
 * descripción, solo cambiarla. Vive en `lib/forms` porque son cuatro pantallas
 * y el formulario que se olvide no dará ningún error.
 */
const aPayload = (d: DatosFormularioGaleria): DatosGaleria => ({
  // Por `limpiar` pasan SOLO los que admiten null. Si pasara el título, un
  // formulario vacío mandaría `title: null` y el tipo diría `string`: el cast
  // que hiciera falta para compilar taparía justo lo que esta tarea arregla.
  ...limpiar({
    description: d.description,
    eventDate: d.eventDate,
    location: d.location,
  }),
  title: d.title.trim(),
  categoryId: d.categoryId,
});

const ETIQUETA = 'text-muted text-xs';
const CAMPO = 'campo lg:min-h-[34px] lg:h-[34px] bg-card border-line px-2.5';

function Error({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-danger text-xs">
      {children}
    </p>
  );
}

export function FormularioGaleria({
  galeria,
  categorias,
  acciones,
  migas,
}: {
  galeria: AdminGalleryDto;
  categorias: CategoryRefDto[];
  /** Publicar y «Ver en la web». No son campos, pero van junto al título. */
  acciones?: ReactNode;
  migas?: ReactNode;
}) {
  const actualizar = useActualizarGaleria(galeria.id);

  const form = useForm<DatosFormularioGaleria>({
    resolver: zodResolver(esquemaGaleria),
    defaultValues: valoresDe(galeria),
  });
  const { register, control, handleSubmit, setError, reset, formState } = form;

  const guardar = handleSubmit(async (datos) => {
    try {
      await actualizar.mutateAsync(aPayload(datos));
      // `reset` con lo guardado: `isDirty` vuelve a false y el botón se apaga.
      reset(datos);
      toast.success('Galería guardada');
    } catch (e) {
      // El servidor manda `details[].field` con rutas con puntos ya listas:
      // setError sin parsear nada.
      if (esApiError(e) && e.isValidation && e.details) {
        for (const d of e.details) {
          setError(d.field as Path<DatosFormularioGaleria>, { message: d.message });
        }
        return;
      }
      toast.error(esApiError(e) ? e.message : 'No se pudo guardar.');
    }
  });

  const errores = formState.errors;

  return (
    /**
     * Guardado EXPLÍCITO, no automático. El autoguardado tenía sentido mientras
     * el editor era un borrador; con el botón, James decide cuándo escribe —y
     * es coherente con Configuración, que ya funciona así.
     *
     * `onSubmit` con `preventDefault`: un Enter que recargara la página en
     * mitad de una subida sería el peor final posible.
     */
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      {/* Apilado en móvil: con las acciones sin encoger, al bloque del título le
          quedaban noventa píxeles y las migas se partían en dos líneas. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
          {migas}
          {/* El título ES el encabezado: se edita donde se lee, sin un campo
              «Título» repitiendo debajo lo que ya pone arriba en grande. */}
          <label htmlFor="title" className="sr-only">
            Título
          </label>
          <input
            id="title"
            {...register('title')}
            aria-invalid={Boolean(errores.title)}
            aria-describedby={errores.title ? 'title-error' : undefined}
            className="dato focus-visible:border-line-strong rounded-control -mx-2 border border-transparent bg-transparent px-2 py-0.5 text-xl font-semibold outline-none"
          />
          {errores.title && <Error id="title-error">{errores.title.message}</Error>}
        </div>
        {acciones && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{acciones}</div>
        )}
      </div>

      {/* Densos y en línea: los cuatro datos del evento caben de un vistazo en
          vez de obligar a bajar por un formulario de una columna. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.25">
          <label htmlFor="categoryId" className={ETIQUETA}>
            Categoría
          </label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Selector
                id="categoryId"
                nombre="Categoría"
                valor={field.value}
                onCambiar={field.onChange}
                onBlur={field.onBlur}
                invalido={Boolean(errores.categoryId)}
                opciones={categorias.map((c) => ({ valor: c.id, etiqueta: c.name }))}
              />
            )}
          />
          {errores.categoryId && <Error>{errores.categoryId.message}</Error>}
        </div>

        <div className="flex flex-col gap-1.25">
          <label htmlFor="eventDate" className={ETIQUETA}>
            Fecha del evento
          </label>
          <Controller
            control={control}
            name="eventDate"
            render={({ field }) => (
              <CampoFecha
                id="eventDate"
                valor={field.value ?? ''}
                onCambiar={field.onChange}
                onBlur={field.onBlur}
                invalido={Boolean(errores.eventDate)}
              />
            )}
          />
          {errores.eventDate && <Error>{errores.eventDate.message}</Error>}
        </div>

        <div className="flex flex-col gap-1.25">
          <label htmlFor="location" className={ETIQUETA}>
            Lugar
          </label>
          <input id="location" {...register('location')} placeholder="Ayacucho" className={CAMPO} />
          {errores.location && <Error>{errores.location.message}</Error>}
        </div>

        <div className="flex flex-col gap-1.25">
          <span className={ETIQUETA}>Enlace</span>
          {/* Solo lectura: el slug se genera al crear y NO se regenera al
              renombrar, porque James comparte esos enlaces por WhatsApp veinte
              veces al día y regenerarlos los rompe todos en silencio. */}
          <p className={`${CAMPO} text-ash dato flex items-center`}>/galerias/{galeria.slug}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.25">
        <label htmlFor="description" className={ETIQUETA}>
          Descripción
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className="campo bg-card border-line min-h-0 px-2.5 py-2"
        />
        {errores.description && <Error>{errores.description.message}</Error>}
      </div>

      <div className="flex items-center gap-3">
        <Boton
          variante="principal"
          type="submit"
          // Deshabilitado sin cambios: pulsar «Guardar» sobre un formulario
          // intacto manda un PATCH que no cambia nada y encima marca la web
          // como pendiente de publicar.
          disabled={!formState.isDirty || formState.isSubmitting}
        >
          {formState.isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Boton>
        {formState.isDirty && !formState.isSubmitting && (
          <span className="text-ash text-sm">Tienes cambios sin guardar</span>
        )}
      </div>
    </form>
  );
}
