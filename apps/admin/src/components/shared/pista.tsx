'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * La etiqueta de un botón que solo es un icono. Un `aria-label` lo resuelve
 * para el lector de pantalla, pero **no para quien mira**: el icono de salir y
 * el de compartir son dos flechas, y averiguar cuál es cuál pulsando no es una
 * opción cuando una cierra la sesión.
 *
 * A mano y no con una librería: son quince líneas de CSS. El `title` nativo
 * tampoco vale — tarda casi un segundo en aparecer, lo pinta el sistema
 * operativo con su propio estilo y **en táctil no existe**.
 *
 * Se muestra al pasar por encima y también **al enfocar con el teclado**
 * (`focus-within`), que es justo cuando más falta hace. `pointer-events-none`
 * para que el globo nunca se coma el clic del botón que describe — el mismo
 * fallo que ya costó una capa con `opacity: 0` sobre las miniaturas.
 */
export function Pista({
  texto,
  lado = 'derecha',
  children,
  className,
}: {
  texto: string;
  /** Hacia dónde sale. En el sidebar va a la derecha; en una fila, arriba. */
  lado?: 'derecha' | 'arriba';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('group/pista relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'border-line-strong bg-chrome text-bone pointer-events-none absolute z-50 hidden',
          'rounded-control border px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow-lg',
          'transition-[opacity,transform] duration-150 lg:block',
          'group-hover/pista:opacity-100 group-focus-within/pista:opacity-100',
          lado === 'derecha'
            ? 'top-1/2 left-full ml-2 -translate-x-1 -translate-y-1/2 group-hover/pista:translate-x-0 group-focus-within/pista:translate-x-0'
            : 'bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 group-hover/pista:translate-y-0 group-focus-within/pista:translate-y-0',
        )}
      >
        {texto}
      </span>
    </span>
  );
}
