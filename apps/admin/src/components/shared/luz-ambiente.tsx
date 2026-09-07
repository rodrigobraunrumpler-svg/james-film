import { cn } from '@/lib/utils/cn';

/**
 * La luz cálida del set detrás del contenido: el tungsteno del flyer, muy
 * tenue y a la deriva. A 24 segundos por recorrido no se ve moverse, se ve que
 * la pantalla «respira».
 *
 * Dos cosas que costaron un desborde cada una:
 *
 * 1. **Va dentro de un recortador `overflow-hidden`.** Un círculo de 640px
 *    colocado con `-right-32` se sale 104px por la derecha a 1024px de ancho, y
 *    eso mete scroll horizontal en TODA la pantalla — el síntoma que §7
 *    prohíbe. El recortador es `absolute inset-0`, así que no está en el flujo
 *    y no rompe el `position: sticky` de la barra de guardar, cosa que un
 *    `overflow-hidden` sobre el contenedor de la pantalla sí haría.
 * 2. **Sin `z-index`.** Con `-z-10` formaba su propio contexto de apilamiento y
 *    se pintaba ANTES que el fondo del layout: invisible. Va primera en el DOM
 *    y el orden del documento ya la deja debajo de todo.
 *
 * Solo desde `lg`: en el móvil de James no aporta nada y es un repintado más.
 */
export function LuzAmbiente({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
    >
      <span className={cn('luz-ambiente absolute aspect-square rounded-full', className)} />
    </span>
  );
}
