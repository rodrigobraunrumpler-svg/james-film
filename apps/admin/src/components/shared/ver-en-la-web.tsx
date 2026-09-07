import { ExternalLink } from 'lucide-react';
import { clasesBoton } from './boton';

/**
 * §9 lo pide explícitamente: «botón "Ver en la web" en cada galería y paquete,
 * que abra la URL pública en otra pestaña».
 *
 * `target="_blank"` a propósito: si navegara en la misma pestaña, James
 * perdería lo que estuviera editando.
 */
export function VerEnLaWeb({
  url,
  etiqueta = 'Ver en la web',
  soloIcono = false,
}: {
  url: string;
  etiqueta?: string;
  /**
   * Solo el icono, con la etiqueta como nombre accesible. Es lo que hace falta
   * donde el botón comparte fila con otros cuatro —la tarjeta de categoría— y
   * el texto rompía en tres líneas descuadrando la fila entera.
   */
  soloIcono?: boolean;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={soloIcono ? etiqueta : undefined}
      title={soloIcono ? etiqueta : undefined}
      className={clasesBoton(
        'fantasma',
        soloIcono ? 'border-line-strong w-11 px-0 lg:w-[30px]' : 'border-line-strong font-normal',
      )}
    >
      <ExternalLink aria-hidden className="size-3.5" />
      {!soloIcono && etiqueta}
    </a>
  );
}
