'use client';

import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { fecha as formatear } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

/**
 * `YYYY-MM-DD` ↔ `Date`, siempre a mediodía UTC. Construir la fecha a medianoche
 * y leerla con `getDate()` local devuelve el DÍA ANTERIOR en Lima (UTC-5), que
 * es exactamente el fallo que §5 documenta para `eventDate`.
 */
const aDate = (iso: string): Date | undefined => (iso ? new Date(`${iso}T12:00:00Z`) : undefined);

const aIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Calendario propio en vez del `<input type="date">`.
 *
 * El nativo abre un panel que pinta el SISTEMA, con su azul: sobre esta paleta
 * se lee como una ventana de otra aplicación. El precio es real y conviene
 * saberlo: en el iPhone se pierde la rueda nativa de iOS. Para una fecha que se
 * pone una vez por galería, y casi siempre del mes en curso, una rejilla es al
 * menos tan buena — pero si James dice lo contrario, se vuelve al nativo.
 */
export function CampoFecha({
  id,
  valor,
  onCambiar,
  onBlur,
  invalido,
}: {
  id: string;
  valor: string;
  onCambiar: (iso: string) => void;
  onBlur?: () => void;
  invalido?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const seleccionada = aDate(valor);

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <div className="relative">
        <Popover.Trigger
          id={id}
          onBlur={onBlur}
          aria-invalid={invalido}
          className="campo bg-card border-line flex w-full items-center gap-2 px-2.5 text-left lg:h-[34px] lg:min-h-0"
        >
          <CalendarDays className="text-muted size-3.5 shrink-0" aria-hidden />
          <span className={cn('min-w-0 flex-1 truncate', !valor && 'text-muted')}>
            {valor ? formatear(valor) : 'Sin fecha'}
          </span>
        </Popover.Trigger>

        {/* Vaciar la fecha tiene que ser posible: `null` la BORRA en el PATCH, y
            sin este botón no hay forma de quitar una que se puso por error. */}
        {valor && (
          <button
            type="button"
            aria-label="Quitar la fecha"
            onClick={() => onCambiar('')}
            className="text-muted hover:text-bone absolute top-0 right-0 flex h-full w-9 items-center justify-center transition-colors duration-150"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="border-line-strong bg-chrome rounded-card z-50 border p-2 shadow-2xl shadow-black/50 data-[state=open]:animate-[sube_0.15s_cubic-bezier(0.2,0.8,0.2,1)_both]"
        >
          <DayPicker
            mode="single"
            locale={es}
            defaultMonth={seleccionada}
            selected={seleccionada}
            onSelect={(d) => {
              if (d) onCambiar(aIso(d));
              setAbierto(false);
            }}
            // Los tokens del admin, no los de la librería: su hoja está pensada
            // para fondo claro y aquí quedaría un bloque blanco.
            style={
              {
                '--rdp-accent-color': 'var(--color-brass)',
                '--rdp-accent-background-color': 'rgba(201,169,106,.16)',
                '--rdp-today-color': 'var(--color-brass)',
                '--rdp-day-width': '2.25rem',
                '--rdp-day-height': '2.25rem',
              } as React.CSSProperties
            }
            className="text-bone [&_.rdp-chevron]:fill-brass [&_.rdp-day_button]:rounded-control [&_.rdp-day_button:hover]:bg-card-hover [&_.rdp-weekday]:text-muted text-sm"
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
