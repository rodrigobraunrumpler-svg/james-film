import type { IsoDate } from '@james-film/contracts';

/**
 * Fechas de CALENDARIO, no instantes.
 *
 * Todo se hace sobre cadenas `YYYY-MM-DD` y `Date` a medianoche **UTC**. En
 * `YYYY-MM-DD` el orden alfabético ES el cronológico, así que comparar rangos
 * no necesita convertir nada — y así no hay zona horaria que equivocar, que es
 * donde se cuela todo (`eventDate` ya salió un día antes por esto).
 *
 * «Hoy» sí necesita zona, y es la de James: `America/Lima`. Sin `timeZone`
 * explícito, un navegador en otra zona empezaría el calendario en otro día.
 */
export const hoyEnLima = (ahora: Date = new Date()): IsoDate =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);

export const aIso = (d: Date): IsoDate => d.toISOString().slice(0, 10);

export const aFecha = (iso: IsoDate): Date => new Date(`${iso}T00:00:00.000Z`);

/** El primer día del mes al que pertenece una fecha. */
export const primeroDelMes = (iso: IsoDate): IsoDate => `${iso.slice(0, 7)}-01`;

/**
 * El mismo día `meses` más adelante, **topado al último día del mes**.
 *
 * `setUTCMonth` a secas se desborda: 31 de enero más uno da el 31 de febrero,
 * que el motor normaliza a 3 de marzo. Avanzando de mes en mes, pulsar
 * «siguiente» un 31 de enero saltaría de febrero a marzo.
 */
export function masMeses(iso: IsoDate, meses: number): IsoDate {
  const [a, m, d] = iso.split('-').map(Number);
  const destino = new Date(Date.UTC(a!, m! - 1 + meses, 1));
  const ultimo = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0),
  ).getUTCDate();
  destino.setUTCDate(Math.min(d!, ultimo));
  return aIso(destino);
}

export function masDias(iso: IsoDate, dias: number): IsoDate {
  const d = aFecha(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return aIso(d);
}

/** Cuántos días hay de `a` a `b`. Sobre fechas UTC no hay horario de verano que corrija. */
export const diasEntre = (a: IsoDate, b: IsoDate): number =>
  Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86_400_000);

/** Todas las fechas de un rango, extremos incluidos y en orden. */
export function rango(a: IsoDate, b: IsoDate): IsoDate[] {
  const [desde, hasta] = a <= b ? [a, b] : [b, a];
  const salida: IsoDate[] = [];
  for (let d = desde; d <= hasta; d = masDias(d, 1)) salida.push(d);
  return salida;
}

export interface CeldaMes {
  fecha: IsoDate;
  /** `false` en los días de relleno que completan la primera y la última semana. */
  delMes: boolean;
}

/**
 * La rejilla de un mes, **empezando en lunes** y siempre con semanas enteras.
 *
 * Se escribe a mano y no con una librería por lo mismo que en la landing: son
 * dos bucles, y el proyecto ya rechazó una librería de fechas por eso.
 */
export function rejillaDelMes(mes: IsoDate): CeldaMes[] {
  const primero = aFecha(primeroDelMes(mes));
  // `getUTCDay()` da 0 el domingo; aquí la semana empieza en lunes.
  const desplazamiento = (primero.getUTCDay() + 6) % 7;
  const inicio = new Date(primero);
  inicio.setUTCDate(inicio.getUTCDate() - desplazamiento);

  const celdas: CeldaMes[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setUTCDate(d.getUTCDate() + i);
    celdas.push({ fecha: aIso(d), delMes: d.getUTCMonth() === primero.getUTCMonth() });
  }

  // La sexta semana solo si hace falta: si no, el mes «baila» de alto al
  // navegar y la columna de al lado se mueve con él.
  return celdas[35]!.delMes || celdas[36]!.delMes ? celdas : celdas.slice(0, 35);
}

const MES_Y_ANO = new Intl.DateTimeFormat('es-PE', {
  month: 'long',
  year: 'numeric',
  // UTC porque es una fecha de calendario: en Lima restaría cinco horas y un
  // día 1 saldría como el último del mes anterior.
  timeZone: 'UTC',
});

export const mesYAno = (iso: IsoDate): string => MES_Y_ANO.format(aFecha(iso));

const DIA_LARGO = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export const diaLargo = (iso: IsoDate): string => DIA_LARGO.format(aFecha(iso));

/** «24 y 25 de octubre» en una línea, sin repetir el mes cuando es el mismo. */
export function rangoLargo(from: IsoDate, to: IsoDate): string {
  if (from === to) return diaLargo(from);
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${from.slice(8).replace(/^0/, '')} y ${diaLargo(to)}`;
  }
  return `${diaLargo(from)} – ${diaLargo(to)}`;
}

/** «Es hoy», «Mañana», «Faltan 12 días». Lo que se lee de un vistazo. */
export function cuantoFalta(iso: IsoDate, hoy: IsoDate): string {
  const d = diasEntre(hoy, iso);
  if (d < 0) return `Hace ${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'}`;
  if (d === 0) return 'Es hoy';
  if (d === 1) return 'Mañana';
  return `Faltan ${d} días`;
}

export const INICIALES_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
