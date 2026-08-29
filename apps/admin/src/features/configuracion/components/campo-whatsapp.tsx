'use client';

import { useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import type { DatosContacto } from '../schemas/ajustes-schema';

/** Solo los dígitos: es lo que hay que comparar entre número y display. */
const digitos = (v: string): string => v.replace(/\D/g, '');

/** `51994724944` → `994 724 944`, quitando el prefijo de país de Perú. */
export const sugerirDisplay = (numero: string): string => {
  const soloDigitos = digitos(numero);
  const sinPrefijo = soloDigitos.startsWith('51') ? soloDigitos.slice(2) : soloDigitos;
  return sinPrefijo.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
};

/**
 * 🔴 El campo más importante del producto: el clic a WhatsApp **es** el lead.
 *
 * Dos cosas que solo se ven aquí:
 *
 * 1. El enlace de prueba. Es la única verificación que existe de verdad — la
 *    hace James, con su teléfono, en dos segundos.
 * 2. El aviso de divergencia. `whatsappNumber` es el que marca y
 *    `whatsappDisplay` el que se enseña: si cambia uno y no el otro, **la web
 *    muestra un número y llama a otro**, que para un cliente es peor que no
 *    tener número. No se bloquea —puede haber un motivo— pero no puede pasar
 *    sin que nadie lo vea.
 */
export function CampoWhatsapp() {
  const { register, watch, setValue, formState } = useFormContext<DatosContacto>();
  const numero = watch('whatsappNumber') ?? '';
  const display = watch('whatsappDisplay') ?? '';
  /**
   * Lo último que propusimos. Sin esto, el guard «solo si está vacío» se
   * cumplía únicamente en la PRIMERA tecla y el display se quedaba congelado en
   * «5»: al teclear letra a letra, tras el primer carácter ya no estaba vacío.
   */
  const ultimaSugerencia = useRef<string | null>(null);

  const divergen =
    numero.length > 0 && display.length > 0 && !digitos(numero).endsWith(digitos(display));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="whatsappNumber" className="text-sm font-medium">
          Número de WhatsApp
        </label>
        <input
          id="whatsappNumber"
          inputMode="numeric"
          placeholder="51994724944"
          {...register('whatsappNumber', {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              // Se PROPONE, no se impone: en cuanto James escriba el suyo, se
              // deja de tocar. Por eso se compara con lo último propuesto.
              const loEscribioEl = display !== '' && display !== ultimaSugerencia.current;
              if (loEscribioEl) return;

              const sugerido = sugerirDisplay(e.target.value);
              ultimaSugerencia.current = sugerido;
              setValue('whatsappDisplay', sugerido);
            },
          })}
          aria-invalid={Boolean(formState.errors.whatsappNumber)}
          className="min-h-11 rounded-md border px-3"
        />
        <p className="text-xs text-neutral-500">
          Con el prefijo del país y sin el «+». Para Perú: 51 y luego el número.
        </p>
        {formState.errors.whatsappNumber && (
          <p role="alert" className="text-sm text-red-600">
            {formState.errors.whatsappNumber.message}
          </p>
        )}

        {digitos(numero).length >= 10 && (
          <a
            href={`https://wa.me/${digitos(numero)}`}
            target="_blank"
            rel="noreferrer"
            className="min-h-11 self-start rounded-md border px-4 py-2 text-sm font-medium"
          >
            Probar este número
          </a>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="whatsappDisplay" className="text-sm font-medium">
          Cómo se muestra
        </label>
        <input
          id="whatsappDisplay"
          placeholder="994 724 944"
          {...register('whatsappDisplay')}
          className="min-h-11 rounded-md border px-3"
        />
        {divergen && (
          <p role="alert" className="text-sm text-amber-700">
            El número que se marca y el que se muestra no coinciden. Revísalo: la web enseñaría uno
            y llamaría a otro.
          </p>
        )}
      </div>
    </div>
  );
}
