'use client';

import type { BusyDayDto, IsoDate } from '@james-film/contracts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { INICIALES_SEMANA, mesYAno, rejillaDelMes } from '../fechas';

export interface Seleccion {
  desde: IsoDate;
  hasta: IsoDate;
}

/**
 * La rejilla del mes. **Solo pinta y avisa**: no sabe marcar ni desmarcar, eso
 * lo decide la pantalla — así el mismo componente sirve para el mes que se está
 * editando sin duplicar la lógica de selección.
 *
 * Sin librería de calendario: la rejilla son dos bucles en `../fechas`, y el
 * proyecto ya rechazó una librería de fechas por lo mismo.
 */
export function CalendarioMes({
  mes,
  hoy,
  ocupados,
  seleccion,
  onMes,
  onDia,
}: {
  mes: IsoDate;
  hoy: IsoDate;
  ocupados: Map<IsoDate, BusyDayDto>;
  seleccion: Seleccion | null;
  onMes: (delta: number) => void;
  onDia: (fecha: IsoDate) => void;
}) {
  const celdas = rejillaDelMes(mes);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => onMes(-1)}
          className="border-line-strong bg-card hover:border-line-hover rounded-control flex size-11 items-center justify-center border transition-colors duration-150 lg:size-8"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {/* `first-letter:uppercase` y NO `capitalize`: `capitalize` sube la
            inicial de CADA palabra y dejaba «Setiembre De 2026». Y el texto no
            se escribe a mano en mayúscula porque `Intl` es quien sabe cómo se
            llama el mes en `es-PE` — «setiembre», sin p. */}
        <p
          aria-live="polite"
          className="font-display text-[17px] font-extrabold first-letter:uppercase"
        >
          {mesYAno(mes)}
        </p>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => onMes(1)}
          className="border-line-strong bg-card hover:border-line-hover rounded-control flex size-11 items-center justify-center border transition-colors duration-150 lg:size-8"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div className="text-muted grid grid-cols-7 gap-0.5 text-center text-[11px] lg:gap-1">
        {INICIALES_SEMANA.map((d, i) => (
          // La inicial se repite (M de martes y de miércoles), así que la clave
          // es el índice: es una lista fija de siete, no datos.
          <span key={i}>{d}</span>
        ))}
      </div>

      {/*
        Sin `role="grid"`: un rol que se declara y no se implementa entero
        —con su navegación por flechas— es peor que ninguno. Son botones en una
        rejilla visual, y como botones se anuncian.
      */}
      {/*
        `gap-0.5` en móvil y no `gap-1`. El alto de un objetivo táctil casi
        nunca falla; **el ancho sí**: siete columnas reparten lo que queda tras
        el `padding` y los huecos, y con 4 px de hueco la celda medía 43 px a
        390. Con 2 px pasa de 44 y es exactamente lo que ya hace el calendario
        de la web, que se topó con esto mismo.

        A 320 px no llega, y no puede: siete columnas de 44 son 308 px y ahí no
        caben ni quitando todo el padding. Se queda en ~38 de ancho por 44 de
        alto, que es el mismo compromiso que la landing.
      */}
      <div className="grid grid-cols-7 gap-0.5 lg:gap-1">
        {celdas.map(({ fecha, delMes }) => {
          const dia = ocupados.get(fecha);
          const ocupado = dia !== undefined;
          const pasado = fecha < hoy;
          // Un día pasado solo se toca si está ocupado: es la única forma de
          // deshacer un rango mal arrastrado, y la API lo permite a propósito.
          const tocable = !pasado || ocupado;
          const dentro =
            seleccion !== null && fecha >= seleccion.desde && fecha <= seleccion.hasta;

          return (
            <button
              key={fecha}
              type="button"
              disabled={!tocable}
              onClick={() => onDia(fecha)}
              aria-pressed={dentro}
              // El nombre accesible dice el ESTADO, no solo el número: un «12»
              // suelto no le sirve de nada a un lector de pantalla.
              aria-label={`${fecha}${ocupado ? ' · ocupado' : ' · libre'}`}
              title={dia?.note ?? undefined}
              className={cn(
                // 44 en táctil por §7 y **56 en escritorio**: es un calendario
                // que se mira de un vistazo, no un selector de fecha metido en
                // un formulario, y con 40 px la tarjeta se quedaba a media
                // altura de la columna de al lado.
                'relative flex min-h-11 items-center justify-center rounded-md border text-sm transition-colors duration-150 lg:min-h-14',
                !delMes && 'opacity-40',
                !tocable && 'text-muted cursor-not-allowed border-transparent',
                tocable && !ocupado && 'border-line text-bone hover:border-line-hover',
                // Ocupado se ve SIN depender del color: además del relleno lleva
                // su punto, que es lo que lo distingue en una pantalla al sol.
                ocupado && 'border-brass/45 text-brass bg-[color-mix(in_oklab,var(--color-brass-relleno)_14%,transparent)]',
                dentro && 'ring-brass bg-active ring-2',
              )}
            >
              {Number(fecha.slice(8))}
              {ocupado && (
                <span
                  aria-hidden
                  className="bg-brass absolute bottom-1 size-1 rounded-full"
                />
              )}
              {fecha === hoy && !ocupado && (
                <span aria-hidden className="bg-ash absolute bottom-1 size-1 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
