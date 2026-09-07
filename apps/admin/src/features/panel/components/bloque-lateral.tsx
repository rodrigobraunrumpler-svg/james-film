'use client';

import type { DashboardDto, SaturdayCountDto } from '@james-film/contracts';
import { Plus, Send, Upload } from 'lucide-react';
import Link from 'next/link';
import { clasesBoton } from '@/components/shared/boton';
import { eventosQueCaben } from '@/lib/almacenamiento';
import { partirTamano, tamano } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

/**
 * Los sábados libres de los tres próximos meses, en el Panel.
 *
 * Es el número de escasez que la web publica —«quedan 2 sábados libres en
 * setiembre»— y estaba solo en Disponibilidad, o sea únicamente si iba a
 * buscarlo. Aquí lo ve al abrir, que es donde decide si sube el precio o mueve
 * algo. Enlaza a la pantalla: un dato que no se puede tocar desde donde se lee
 * obliga a buscarla, y entonces se ignora.
 */
export function BloqueSabados({ meses }: { meses: SaturdayCountDto[] }) {
  if (meses.length === 0) return null;
  const sinNada = meses.every((m) => m.total === 0);

  return (
    <section
      className="entra bg-card border-line rounded-card elevada border px-4.5 py-4"
      style={{ '--i': 5 } as React.CSSProperties}
      aria-label="Sábados libres"
    >
      <h2 className="text-muted text-xs tracking-[0.1em] uppercase">Sábados libres</h2>
      {sinNada ? (
        // El vacío se DICE: un hueco no distingue «no quedan» de «no cargó».
        <p className="text-ash mt-2 text-sm">No quedan sábados por delante este trimestre.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {meses.map((m) => (
            <li key={m.month} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="first-letter:uppercase">{mesDe(m.month)}</span>
              <span
                className={cn(
                  'tabular-nums',
                  // Sin ninguno libre es una noticia, no un dato de relleno.
                  m.free === 0 ? 'text-brass font-medium' : 'text-ash',
                )}
              >
                {m.free} de {m.total}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/disponibilidad" className={clasesBoton('fantasma', 'mt-2.5 w-full')}>
        Ver el calendario
      </Link>
    </section>
  );
}

const MES = new Intl.DateTimeFormat('es-PE', {
  month: 'long',
  // UTC porque es fecha de calendario: en Lima restaría cinco horas y un día 1
  // saldría como el último del mes anterior.
  timeZone: 'UTC',
});
const mesDe = (iso: string): string => MES.format(new Date(`${iso}T00:00:00.000Z`));

/** El medidor, en su tarjeta. Que vea el límite venir antes de chocar con él. */
export function BloqueEspacio({ storage }: { storage: DashboardDto['storage'] }) {
  const { usedBytes, quotaBytes } = storage;
  const porcentaje = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));
  const eventos = eventosQueCaben(usedBytes, quotaBytes);
  const apurado = porcentaje >= 85;

  const techo = partirTamano(quotaBytes);

  return (
    <section
      className="entra bg-card border-line rounded-card elevada border px-4.5 py-4"
      style={{ '--i': 3 } as React.CSSProperties}
      aria-label="Espacio"
    >
      <p className="flex items-baseline gap-2">
        <span className="font-display text-[22px] font-extrabold tracking-[-0.02em] tabular-nums">
          {tamano(usedBytes)}
        </span>
        <span className="text-muted text-sm">
          de {techo.valor} {techo.unidad}
        </span>
      </p>

      <div className="bg-line my-2.5 h-1.5 overflow-hidden rounded-full">
        <div
          className={cn('barra-crece h-full', apurado ? 'bg-danger' : 'bg-brass')}
          style={{ width: `${porcentaje}%`, '--i': 4 } as React.CSSProperties}
        />
      </div>

      <p className="text-muted text-xs">
        {eventos > 0
          ? `Quedan unos ${eventos} eventos antes del tramo de pago`
          : 'Casi sin espacio: toca borrar o pagar'}
      </p>
    </section>
  );
}

/**
 * Lo que James hace de verdad, a un clic de donde aterriza. Los tres atajos son
 * los del prototipo, pero el segundo y el tercero solo salen si TIENEN sentido:
 * «Subir a …» sin ninguna galería llevaría a un 404, y «Publicar los cambios»
 * sin cambios pendientes es un botón que no hace nada.
 */
export function BloqueAtajos({
  ultimaGaleria,
  pendingChanges,
}: {
  ultimaGaleria: DashboardDto['ultimaGaleria'];
  pendingChanges: number;
}) {
  return (
    <section
      className="entra bg-card border-line rounded-card flex flex-col gap-2 border px-4 py-3.5"
      style={{ '--i': 4 } as React.CSSProperties}
      aria-label="Atajos"
    >
      <h2 className="text-muted text-xs">Lo de siempre</h2>

      <Link href="/?nueva=true" className={clasesBoton('principal', 'h-[38px] justify-start')}>
        <Plus className="size-3.5" aria-hidden />
        Nueva galería
      </Link>

      {ultimaGaleria && (
        <Link
          href={`/galerias/${ultimaGaleria.id}`}
          className={clasesBoton('secundario', 'h-[38px] justify-start')}
        >
          <Upload className="size-3.5 shrink-0" aria-hidden />
          <span className="dato min-w-0 truncate">Subir a «{ultimaGaleria.title}»</span>
        </Link>
      )}

      {pendingChanges > 0 && (
        <button type="button" className={clasesBoton('secundario', 'h-[38px] justify-start')}>
          <Send className="size-3.5" aria-hidden />
          Publicar {pendingChanges === 1 ? 'el cambio' : `los ${pendingChanges} cambios`}
        </button>
      )}
    </section>
  );
}
