'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { TEMAS, type Tema } from '@/lib/tema';
import { cn } from '@/lib/utils/cn';

const ICONO: Record<Tema, typeof Sun> = { sistema: Monitor, claro: Sun, oscuro: Moon };
const ETIQUETA: Record<Tema, string> = {
  sistema: 'Seguir al sistema',
  claro: 'Tema claro',
  oscuro: 'Tema oscuro',
};

/**
 * El interruptor de tema, en el pie del menú junto al perfil: es donde ya
 * viven los ajustes de la sesión y no compite con el trabajo.
 *
 * Tres posiciones y no un botón que cicla: con un ciclo hay que pulsar para
 * descubrir qué viene, y «seguir al sistema» —que es el valor de arranque— no
 * tendría forma de recuperarse una vez elegido otro.
 *
 * `radiogroup` y no botones sueltos: son opciones excluyentes de un mismo
 * ajuste, y así el lector de pantalla anuncia «1 de 3» en vez de tres botones
 * sin relación.
 */
export function SelectorTema({
  tema,
  elegir,
  listo,
  className,
}: {
  tema: Tema;
  elegir: (t: Tema) => void;
  /** Antes de leer `localStorage` no se marca ninguno: marcar el que no es y
      corregirlo al montar se ve como un salto. */
  listo: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tema del panel"
      className={cn('bg-well rounded-control flex shrink-0 gap-0.5 p-0.5', className)}
    >
      {TEMAS.map((t) => {
        const Icono = ICONO[t];
        const activo = listo && tema === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={ETIQUETA[t]}
            title={ETIQUETA[t]}
            onClick={() => elegir(t)}
            className={cn(
              // 44px táctil como todo lo pulsable; en escritorio baja a 22,
              // que es la altura del pie del menú.
              'flex size-11 items-center justify-center rounded-[5px] transition-colors duration-150 lg:h-[22px] lg:w-6',
              activo
                ? 'bg-card text-brass shadow-[0_1px_2px_rgba(0,0,0,0.18)]'
                : 'text-sutil hover:text-ash',
            )}
          >
            <Icono className="size-3" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
