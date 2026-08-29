'use client';

import { ArrowDown, ArrowUp, Check, Plus, X } from 'lucide-react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import type { DatosFormularioPaquete } from '../schemas/paquete-schema';

/**
 * Los bullets se editan aquí y viajan CON el paquete, en un solo `PATCH`.
 * Con endpoints por bullet, guardar sería una ráfaga de seis peticiones que
 * puede fallar a medias y dejar el paquete en un estado que nadie pidió.
 */
/** Icono cuadrado de la fila: 44px en táctil, 30 en escritorio. */
const ICONO =
  'flex size-11 shrink-0 items-center justify-center rounded-control border border-line-strong bg-card text-ash transition-colors duration-150 hover:border-line-hover hover:text-bone disabled:opacity-35 lg:size-[30px]';

export function CamposBullets({ form }: { form: UseFormReturn<DatosFormularioPaquete> }) {
  // `keyName: 'clave'` para no pisar el `id` del bullet, que es el del servidor
  // y tiene que viajar en el PATCH: sin él, el backend lo trataría como nuevo.
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'items',
    keyName: 'clave',
  });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted text-xs">Qué incluye</span>

      <ul className="flex flex-col gap-1.5">
        {fields.map((campo, i) => (
          <li
            key={campo.clave}
            className="border-line bg-card rounded-control group flex items-center gap-1.5 border p-1.5"
          >
            {/* El punto es la fila entera: el input va sin borde propio porque
                el borde ya lo pone la fila. Dos bordes anidados a 1px se leen
                como un error de maquetación. */}
            <input
              {...form.register(`items.${i}.text`)}
              aria-label={`Punto ${i + 1}`}
              placeholder="7 Reels / TikToks en tendencia"
              className="text-bone placeholder:text-muted min-h-11 min-w-0 flex-1 border-0 bg-transparent px-2 outline-none lg:min-h-8"
            />

            {/* «Incluido» como interruptor de texto: un punto NO incluido se
                pinta tachado en la landing, así que el estado tiene que verse
                aquí igual que se verá allí. */}
            <label className="relative shrink-0">
              <input
                type="checkbox"
                {...form.register(`items.${i}.included`)}
                className="peer sr-only"
              />
              <span className="border-line-strong text-muted peer-checked:border-brass peer-checked:text-brass peer-focus-visible:outline-brass rounded-control flex min-h-11 cursor-pointer items-center gap-1.5 border px-2 text-xs transition-colors duration-150 peer-not-checked:line-through peer-focus-visible:outline-2 lg:min-h-8">
                <Check className="size-3 opacity-0 peer-checked:opacity-100" aria-hidden />
                Incluido
              </span>
            </label>

            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`Subir punto ${i + 1}`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                className={ICONO}
              >
                <ArrowUp className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Bajar punto ${i + 1}`}
                disabled={i >= fields.length - 1}
                onClick={() => move(i, i + 1)}
                className={ICONO}
              >
                <ArrowDown className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Quitar punto ${i + 1}`}
                onClick={() => remove(i)}
                className={`${ICONO} hover:border-danger-line hover:text-danger`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {form.formState.errors.items && (
        <p role="alert" className="text-danger text-sm">
          {form.formState.errors.items.message ?? 'Revisa los puntos'}
        </p>
      )}

      {/* Discontinuo y en latón: dice «aquí se añade», no «esta es la acción
          principal del formulario» — que lo es Guardar. */}
      <button
        type="button"
        onClick={() => append({ text: '', included: true })}
        className="border-brass/60 text-brass hover:bg-brass/10 hover:border-brass rounded-control flex min-h-11 items-center justify-center gap-1.5 border border-dashed text-sm font-medium transition-colors duration-150 lg:min-h-9"
      >
        <Plus className="size-3.5" aria-hidden />
        Añadir punto
      </button>
    </div>
  );
}
