'use client';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import type { DatosFormularioPaquete } from '../schemas/paquete-schema';

/**
 * Los bullets se editan aquí y viajan CON el paquete, en un solo `PATCH`.
 * Con endpoints por bullet, guardar sería una ráfaga de seis peticiones que
 * puede fallar a medias y dejar el paquete en un estado que nadie pidió.
 */
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
      <span className="text-sm font-medium">Qué incluye</span>

      <ul className="flex flex-col gap-2">
        {fields.map((campo, i) => (
          <li key={campo.clave} className="flex items-start gap-2">
            <input
              {...form.register(`items.${i}.text`)}
              aria-label={`Punto ${i + 1}`}
              className="min-h-11 min-w-0 flex-1 rounded-md border px-3"
            />
            <label className="flex min-h-11 shrink-0 items-center gap-1 text-xs">
              <input type="checkbox" {...form.register(`items.${i}.included`)} />
              {/* Un bullet no incluido se pinta TACHADO en la landing. */}
              <span>Incluido</span>
            </label>
            <button
              type="button"
              aria-label={`Subir punto ${i + 1}`}
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
              className="min-h-11 min-w-11 shrink-0 rounded-md border disabled:opacity-40"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Bajar punto ${i + 1}`}
              disabled={i >= fields.length - 1}
              onClick={() => move(i, i + 1)}
              className="min-h-11 min-w-11 shrink-0 rounded-md border disabled:opacity-40"
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`Quitar punto ${i + 1}`}
              onClick={() => remove(i)}
              className="min-h-11 min-w-11 shrink-0 rounded-md border"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {form.formState.errors.items && (
        <p role="alert" className="text-sm text-red-600">
          {form.formState.errors.items.message ?? 'Revisa los puntos'}
        </p>
      )}

      <button
        type="button"
        onClick={() => append({ text: '', included: true })}
        className="min-h-11 rounded-md border px-4 text-sm font-medium"
      >
        Añadir punto
      </button>
    </div>
  );
}
