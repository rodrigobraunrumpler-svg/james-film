import type { IsoDate } from '@james-film/contracts';

/**
 * `YYYY-MM-DD` de HOY en Lima.
 *
 * `en-CA` da el formato ISO ya ordenado, que es el truco para no montar la
 * cadena a mano. **El `timeZone` explícito no es opcional**: el contenedor
 * corre en UTC, así que a partir de las 19:00 de Lima el servidor ya está en el
 * día siguiente y la ventana entera se desplaza un día.
 */
export const hoyEnLima = (ahora: Date = new Date()): IsoDate =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);

/**
 * Prisma devuelve un `Date` a medianoche UTC para una columna `@db.Date`.
 * `slice(0,10)` sobre el ISO es lo único correcto: cualquier formateo local
 * resta cinco horas y devuelve el día anterior. Ya pasó con `eventDate`.
 */
export const aIsoDate = (d: Date): IsoDate => d.toISOString().slice(0, 10);

/** `YYYY-MM-DD` → el `Date` a medianoche UTC que espera una columna `@db.Date`. */
export const aFechaUtc = (iso: IsoDate): Date => new Date(`${iso}T00:00:00.000Z`);

/**
 * La misma fecha, `meses` más adelante, **con tope en el último día del mes**.
 *
 * El `setUTCMonth` a secas se DESBORDA: `2026-01-31` más un mes da el 31 de
 * febrero, que el motor normaliza a **3 de marzo**. Con doce meses no se nota
 * —cae en el mismo mes— pero la navegación del calendario avanza de uno en uno
 * y ahí sí: pulsar «siguiente» un 31 de enero saltaría de febrero a marzo.
 *
 * Es la misma implementación que `apps/web/src/lib/fechas.ts`, que ya lo tenía
 * bien; ésta se escribió después y se dejó el desbordamiento. Duplicarla es lo
 * correcto: `packages/contracts` es **solo tipos, cero runtime**, así que un
 * helper compartido obligaría a las tres apps a transpilar el paquete.
 */
export function masMeses(iso: IsoDate, meses: number): IsoDate {
  const [a, m, d] = iso.split('-').map(Number);
  const destino = new Date(Date.UTC(a!, m! - 1 + meses, 1));
  // Día 0 del mes siguiente = último día de éste.
  const ultimo = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0),
  ).getUTCDate();
  destino.setUTCDate(Math.min(d!, ultimo));
  return aIsoDate(destino);
}
