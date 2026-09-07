'use client';

import type { ClickStatsDto, WhatsappSource } from '@james-film/contracts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Los colores de los tramos, en el orden en que llegan. Latón para el que más
 * clics tiene y grises decrecientes para el resto: es la **regla del acento
 * único** de §6 aplicada a una barra — si todos los tramos fueran de color, no
 * habría ninguno destacado.
 */
// Del latón de relleno, no de un hex a mano: sobre blanco, el #9A7F47 que
// había escrito queda apagado, y el punto de estos tres tramos es que se
// distingan. `brass` es el fuerte, `brass-relleno` el medio, `sutil` el flojo.
const TRAMOS = ['bg-brass', 'bg-brass-relleno', 'bg-sutil'] as const;

/**
 * El único número que mide el negocio: el clic a WhatsApp ES el lead (§1 §9).
 * Va con su serie de 30 días porque un número solo no dice si sube o baja, y
 * con el reparto por paquete porque saber CUÁL tira es lo accionable.
 */
export function BloqueClics({ clicks }: { clicks: ClickStatsDto }) {
  const diferencia = clicks.total - clicks.previousTotal;
  const maximo = Math.max(1, ...clicks.daily.map((d) => d.count));
  // Los siete últimos en latón: «esta semana» contra el resto del mes.
  const desdeCuandoEsSemana = clicks.daily.length - 7;

  const total = clicks.byPackage.reduce((s, p) => s + p.count, 0) + clicks.noPackage;
  const reparto = clicks.byPackage.slice(0, TRAMOS.length);
  const resto = total - reparto.reduce((s, p) => s + p.count, 0);

  return (
    <section
      className="entra bg-card border-line rounded-card elevada border px-4.5 py-4"
      style={{ '--i': 2 } as React.CSSProperties}
      aria-label="Clics a WhatsApp"
    >
      <div className="flex flex-wrap items-end gap-3">
        <span className="font-display text-[44px] leading-[0.9] font-extrabold tracking-[-0.02em] tabular-nums">
          {clicks.total}
        </span>
        <div className="pb-1">
          <p className="text-ash">clics a WhatsApp</p>
          <p className="text-muted text-xs">últimos 30 días</p>
        </div>
        {diferencia !== 0 && <Variacion diferencia={diferencia} />}
      </div>

      <Serie
        dias={clicks.daily}
        maximo={maximo}
        desdeCuandoEsSemana={desdeCuandoEsSemana}
        vacia={clicks.total === 0}
      />

      {total > 0 && (
        <>
          <div className="bg-line my-3.5 h-px" />
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {reparto.map((p, i) => (
              <div
                key={p.packageId}
                className={cn('barra-crece origin-left', TRAMOS[i])}
                style={{ width: `${(p.count / total) * 100}%`, '--i': i } as React.CSSProperties}
              />
            ))}
            {resto > 0 && (
              <div
                className="bg-line barra-crece origin-left"
                style={
                  {
                    width: `${(resto / total) * 100}%`,
                    '--i': reparto.length,
                  } as React.CSSProperties
                }
              />
            )}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            {reparto.map((p, i) => (
              <li key={p.packageId} className="text-ash flex items-center gap-1.5">
                <span className={cn('size-2 shrink-0 rounded-[2px]', TRAMOS[i])} aria-hidden />
                <span className="dato">{p.packageName}</span>
                <b className="text-bone font-medium tabular-nums">{p.count}</b>
              </li>
            ))}
            {resto > 0 && (
              <li className="text-ash flex items-center gap-1.5">
                <span className="bg-line size-2 shrink-0 rounded-[2px]" aria-hidden />
                Sin paquete
                <b className="text-bone font-medium tabular-nums">{resto}</b>
              </li>
            )}
          </ul>

          <Lectura reparto={clicks.byPackage} />
          <PorFuente reparto={clicks.bySource} />
        </>
      )}
    </section>
  );
}

/**
 * Cómo se llama cada fuente para quien la lee.
 *
 * El tipo es `Record<WhatsappSource, string>` y NO `Record<string, string>`, y
 * ésa es la parte que importa: con `string` se pueden añadir fuentes en el
 * contrato y en la API sin que nada avise, y el panel las pinta CRUDAS —
 * «barra», «menu»— en medio de frases escritas. Pasó justo con esas dos. Ahora
 * añadir una a la unión y no nombrarla aquí **no compila**.
 */
const FUENTE: Record<WhatsappSource, string> = {
  hero: 'Desde el hero',
  barra: 'Desde la barra de arriba',
  menu: 'Desde el menú',
  paquetes: 'Desde los paquetes',
  footer: 'Desde el pie',
  galeria: 'Desde una galería',
  'calendario-libre': 'Calendario · día libre',
  'calendario-ocupado': 'Calendario · día cogido',
  negocios: 'Desde Negocios',
};

/**
 * De DÓNDE salieron, que es otra pregunta que de qué paquete.
 *
 * El Panel solo contestaba la segunda, así que no había forma de saber si el
 * calendario —o la línea de Negocios, que es medio producto— trae gente. Aquí
 * es donde se ve si una sección entera de la web está sirviendo para algo.
 */
function PorFuente({ reparto }: { reparto: ClickStatsDto['bySource'] }) {
  if (reparto.length === 0) return null;
  const total = reparto.reduce((s, f) => s + f.clicks, 0);

  return (
    <div className="border-line mt-3.5 border-t pt-3">
      <h3 className="text-muted text-xs tracking-[0.1em] uppercase">De dónde salieron</h3>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        {reparto.map((f) => (
          <li key={f.source} className="flex items-baseline gap-2">
            <span className="text-ash min-w-0 flex-1 truncate">
              {FUENTE[f.source] ?? f.source}
            </span>
            <b className="text-bone font-medium tabular-nums">{f.clicks}</b>
            {/* El porcentaje al lado del número: «12» no dice nada sin saber
                sobre cuánto, y quien mira no va a dividir de cabeza. */}
            <span className="text-muted w-10 text-right text-xs tabular-nums">
              {Math.round((f.clicks / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Variacion({ diferencia }: { diferencia: number }) {
  const sube = diferencia > 0;
  const Icono = sube ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'mb-1.5 ml-auto inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-sm',
        sube ? 'border-brass/35 bg-brass/8 text-brass' : 'border-line-strong text-ash',
      )}
    >
      <Icono className="size-3" aria-hidden />
      {Math.abs(diferencia)} {sube ? 'más' : 'menos'} que antes
    </span>
  );
}

/**
 * Treinta columnas con `scaleY`, nunca `height`: animar la altura reflowea las
 * treinta en cada fotograma. El escalonado es corto (22ms) para que se lea como
 * UN gesto de izquierda a derecha y no como treinta animaciones sueltas.
 */
function Serie({
  dias,
  maximo,
  desdeCuandoEsSemana,
  vacia,
}: {
  dias: ClickStatsDto['daily'];
  maximo: number;
  desdeCuandoEsSemana: number;
  vacia: boolean;
}) {
  return (
    <>
      <div className="mt-4 mb-1.5 flex h-12 items-end gap-[3px]" aria-hidden>
        {dias.map((d, i) => (
          <span
            key={d.date}
            className={cn(
              'columna-crece min-w-0 flex-1 rounded-[2px]',
              i >= desdeCuandoEsSemana ? 'bg-brass' : 'bg-line-strong',
            )}
            // Suelo de 3px: un día a cero tiene que verse como un día, no como
            // un hueco. Sin él, una racha mala se lee como que falta la gráfica.
            style={
              {
                height: `${Math.max(3, (d.count / maximo) * 44)}px`,
                '--i': i,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="text-muted flex justify-between text-[10px]">
        <span>hace 30 días</span>
        <span className={vacia ? undefined : 'text-brass'}>esta semana</span>
      </div>
    </>
  );
}

/**
 * La frase que convierte el gráfico en una decisión. Solo aparece cuando el
 * reparto es DESIGUAL de verdad: escribirla siempre la vuelve ruido y James
 * deja de leerla justo el mes en que dice algo.
 */
function Lectura({ reparto }: { reparto: ClickStatsDto['byPackage'] }) {
  if (reparto.length < 2) return null;
  const primero = reparto[0]!;
  const ultimo = reparto[reparto.length - 1]!;
  if (ultimo.count * 3 > primero.count) return null;

  return (
    <p className="text-muted mt-3 text-xs leading-relaxed">
      El {ultimo.packageName} lleva {ultimo.count} contra {primero.count} del {primero.packageName}.
      O no se ve, o el precio asusta.
    </p>
  );
}
