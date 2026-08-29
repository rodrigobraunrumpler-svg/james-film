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
}: {
  url: string;
  etiqueta?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={clasesBoton('fantasma', 'border-line-strong font-normal')}
    >
      <ExternalLink aria-hidden className="size-3.5" />
      {etiqueta}
    </a>
  );
}
