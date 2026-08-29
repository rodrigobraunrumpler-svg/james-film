'use client';

import * as Popover from '@radix-ui/react-popover';
import { Ban, ChevronDown, type LucideIcon } from 'lucide-react';
import { iconoDe } from '@/lib/iconos/mapa';
import { cn } from '@/lib/utils/cn';

/**
 * Un ícono se elige por su FORMA, no por su nombre. Un `<select>` de texto
 * obliga a leer «bar-chart-3» e imaginárselo; aquí se ve, que es todo lo que
 * hacía falta. Y de paso el desplegable deja de pintarlo el sistema operativo.
 *
 * Rejilla y no lista: veintitrés opciones en columna son un scroll largo; en
 * cinco columnas caben de un vistazo.
 */
export function SelectorIcono({
  id,
  valor,
  opciones,
  onCambiar,
}: {
  id: string;
  valor: string;
  opciones: string[];
  onCambiar: (valor: string) => void;
}) {
  const Actual = valor ? iconoDe(valor) : Ban;

  return (
    <Popover.Root>
      <Popover.Trigger
        id={id}
        className="campo bg-card border-line flex w-full items-center gap-2 px-2.5 text-left lg:h-[34px] lg:min-h-0"
      >
        <Actual
          className={cn('size-4 shrink-0', valor ? 'text-brass' : 'text-muted')}
          aria-hidden
        />
        <span className={cn('min-w-0 flex-1 truncate', !valor && 'text-muted')}>
          {valor || 'Ninguno'}
        </span>
        <ChevronDown className="text-muted size-3.5 shrink-0" aria-hidden />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="border-line-strong bg-chrome rounded-card z-50 w-[min(20rem,90vw)] border p-2 shadow-2xl shadow-black/50 data-[state=open]:animate-[sube_0.15s_cubic-bezier(0.2,0.8,0.2,1)_both]"
        >
          <div className="grid max-h-72 grid-cols-5 gap-1 overflow-y-auto overscroll-contain">
            <Opcion
              nombre=""
              etiqueta="Ninguno"
              Icono={Ban}
              elegido={!valor}
              onElegir={() => onCambiar('')}
            />
            {opciones.map((nombre) => (
              <Opcion
                key={nombre}
                nombre={nombre}
                etiqueta={nombre}
                Icono={iconoDe(nombre)}
                elegido={valor === nombre}
                onElegir={() => onCambiar(nombre)}
              />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Opcion({
  nombre,
  etiqueta,
  Icono,
  elegido,
  onElegir,
}: {
  nombre: string;
  etiqueta: string;
  Icono: LucideIcon;
  elegido: boolean;
  onElegir: () => void;
}) {
  return (
    <Popover.Close asChild>
      <button
        type="button"
        onClick={onElegir}
        // El nombre en `aria-label` y en `title`: se elige por la forma, pero
        // quien navegue con lector de pantalla necesita oír cuál es.
        aria-label={etiqueta}
        aria-pressed={elegido}
        title={etiqueta}
        className={cn(
          'rounded-control flex aspect-square items-center justify-center border transition-colors duration-150',
          elegido
            ? 'border-brass text-brass bg-brass/10'
            : 'text-ash hover:bg-card-hover hover:text-bone border-transparent',
        )}
      >
        <Icono className="size-4" aria-hidden />
        <span className="sr-only">{nombre || 'Sin ícono'}</span>
      </button>
    </Popover.Close>
  );
}
