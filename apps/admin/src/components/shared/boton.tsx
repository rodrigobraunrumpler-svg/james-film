import { cn } from '@/lib/utils/cn';

/**
 * No es una librería de componentes: son dos variantes y un tamaño, en un sitio,
 * porque el mismo botón aparece en las ocho pantallas y copiarlo ocho veces es
 * como se acaba con ocho botones ligeramente distintos.
 *
 * `principal` lleva el latón EN EL BORDE. Un botón sólido dorado no existe en
 * el admin: el único de la marca es el CTA de WhatsApp, y ese vive en la landing.
 */
const VARIANTES = {
  principal: 'border border-brass text-brass hover:bg-brass/10',
  secundario: 'border border-line-strong bg-card text-bone hover:bg-card-hover',
  fantasma: 'border border-transparent text-ash hover:bg-card-hover hover:text-bone',
  peligro: 'border border-danger-line text-danger hover:bg-danger-bg',
} as const;

export type VarianteBoton = keyof typeof VARIANTES;

/**
 * `min-h-11` (44px) es el mínimo táctil de §7. En escritorio baja a los 32px de
 * la guía, que es la altura que hace que la pantalla se lea densa y no espaciada.
 */
export function clasesBoton(variante: VarianteBoton = 'secundario', extra?: string): string {
  return cn(
    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control px-3 font-medium',
    'text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 lg:min-h-[30px]',
    VARIANTES[variante],
    extra,
  );
}

export function Boton({
  variante = 'secundario',
  className,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & { variante?: VarianteBoton }) {
  return <button type={type} className={clasesBoton(variante, className)} {...props} />;
}
