'use client';

import { Check, ExternalLink } from 'lucide-react';
import { useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { clasesBoton } from '@/components/shared/boton';
import type { DatosContacto } from '../schemas/ajustes-schema';

/** Solo los dígitos: es lo que hay que comparar entre número y display. */
const digitos = (v: string): string => v.replace(/\D/g, '');

/**
 * El MISMO enlace que pintará la web: `wa.me/<número>?text=<mensaje>`.
 *
 * `encodeURIComponent` y no `URLSearchParams`: este codifica el espacio como
 * `+`, y WhatsApp lo pinta como un `+` literal dentro del mensaje en vez de
 * como un espacio. Se ve raro en el chat del cliente y no hay forma de
 * enterarse salvo probándolo.
 */
export const enlaceWhatsapp = (digitosDelNumero: string, mensaje: string): string =>
  mensaje.trim()
    ? `https://wa.me/${digitosDelNumero}?text=${encodeURIComponent(mensaje.trim())}`
    : `https://wa.me/${digitosDelNumero}`;

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
   * El mensaje viaja en el enlace de prueba. Sin él, «Probar este número»
   * abría un chat VACÍO: comprobaba que el número existe, pero no lo que de
   * verdad va a pasar al pulsar el botón de la web — que es abrir el chat con
   * el texto ya escrito. Probar una cosa distinta de la que se publica es lo
   * mismo que no probar.
   */
  const mensaje = watch('whatsappMessage') ?? '';
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
        <label htmlFor="whatsappNumber" className="text-muted text-xs">
          Número de WhatsApp
        </label>
        <input
          id="whatsappNumber"
          // El autorrelleno del navegador tapa la línea de ayuda de debajo, y
          // aquí no hay nada suyo que sugerir: es el número de la web, no el
          // de quien rellena.
          autoComplete="off"
          data-1p-ignore
          data-lpignore
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
          // Borde reforzado y cifras tabulares: es el campo del que depende el
          // negocio entero, y con la anchura variable de Inter los dígitos
          // bailan al teclear un número de doce.
          className="campo border-line-strong tabular-nums"
        />
        {digitos(numero).length >= 10 && !formState.errors.whatsappNumber ? (
          <p className="text-ash flex items-center gap-1.5 text-xs">
            <Check className="size-3 shrink-0 text-[#25D366]" aria-hidden />
            Perú · móvil · {digitos(numero).length - 2} dígitos tras el 51
          </p>
        ) : (
          <p className="text-muted text-xs">
            Con el prefijo del país y sin el «+». Para Perú: 51 y luego el número.
          </p>
        )}
        {formState.errors.whatsappNumber && (
          <p role="alert" className="text-danger text-sm">
            {formState.errors.whatsappNumber.message}
          </p>
        )}

        {digitos(numero).length >= 10 && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <a
              href={enlaceWhatsapp(digitos(numero), mensaje)}
              target="_blank"
              rel="noreferrer"
              className={clasesBoton('secundario')}
            >
              <ExternalLink className="size-3.5" aria-hidden />
              {mensaje ? 'Probar con el mensaje' : 'Probar este número'}
            </a>
            {/* Qué va a pasar al pulsarlo. Sin esta línea, «Probar» podía leerse
                como «mandar un mensaje al cliente», que es justo lo que no hace. */}
            <span className="text-muted text-xs">
              Se abre en tu WhatsApp, con el texto ya escrito.
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="whatsappDisplay" className="text-muted text-xs">
          Cómo se muestra
        </label>
        <input
          id="whatsappDisplay"
          autoComplete="off"
          data-1p-ignore
          data-lpignore
          placeholder="994 724 944"
          {...register('whatsappDisplay')}
          className="campo border-line"
        />
        {divergen && (
          <p role="alert" className="text-ash text-sm">
            El número que se marca y el que se muestra no coinciden. Revísalo: la web enseñaría uno
            y llamaría a otro.
          </p>
        )}
      </div>
    </div>
  );
}
