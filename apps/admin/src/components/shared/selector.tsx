'use client';

import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface Opcion {
  valor: string;
  etiqueta: string;
}

/**
 * El `<select>` nativo no se puede estilar: su desplegable lo pinta el SISTEMA
 * OPERATIVO, con su azul y su tipografía, y sobre esta paleta se lee como una
 * ventana de otra aplicación. Radix lo sustituye por un menú del documento —así
 * que hereda los tokens— manteniendo lo que hace bueno al nativo: teclado,
 * escribir para buscar, `aria-activedescendant` y foco atrapado.
 *
 * En iOS Radix cae en un menú propio, no en la rueda del sistema. Es el precio,
 * y con cuatro categorías no se nota; con cuarenta habría que revisarlo.
 */
export function Selector({
  id,
  valor,
  opciones,
  onCambiar,
  onBlur,
  invalido,
  nombre,
}: {
  id: string;
  valor: string;
  opciones: Opcion[];
  onCambiar: (valor: string) => void;
  onBlur?: () => void;
  invalido?: boolean;
  /** Para que un lector de pantalla lo anuncie con su etiqueta. */
  nombre?: string;
}) {
  return (
    <Select.Root value={valor} onValueChange={onCambiar}>
      <Select.Trigger
        id={id}
        onBlur={onBlur}
        aria-invalid={invalido}
        aria-label={nombre}
        className={cn(
          'campo bg-card border-line flex items-center justify-between gap-2 px-2.5 text-left lg:h-[34px] lg:min-h-0',
          'data-[state=open]:border-line-hover',
        )}
      >
        <Select.Value />
        <Select.Icon>
          {/* Gira al abrir: `transform`, 150ms. Dice que el menú está desplegado
              sin necesidad de mirar dónde está. */}
          <ChevronDown className="text-muted size-3.5 transition-transform duration-150 data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'border-line-strong bg-chrome rounded-control z-50 overflow-hidden border shadow-2xl shadow-black/50',
            // `--radix-select-trigger-width` la publica Radix: el menú mide lo
            // mismo que el campo, en vez de encogerse al texto más largo.
            'w-[var(--radix-select-trigger-width)]',
            'data-[state=open]:animate-[sube_0.15s_cubic-bezier(0.2,0.8,0.2,1)_both]',
          )}
        >
          <Select.Viewport className="p-1">
            {opciones.map((o) => (
              <Select.Item
                key={o.valor}
                value={o.valor}
                className="text-ash data-[highlighted]:bg-active data-[highlighted]:text-bone data-[state=checked]:text-bone rounded-control relative flex min-h-11 cursor-pointer items-center justify-between gap-2 px-2.5 outline-none select-none lg:min-h-8"
              >
                <Select.ItemText>{o.etiqueta}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check className="text-brass size-3.5" aria-hidden />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
