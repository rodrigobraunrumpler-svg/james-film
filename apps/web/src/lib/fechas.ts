/**
 * Fechas, sin librería.
 *
 * **Perú es UTC−5 fijo, sin horario de verano.** Ese único hecho borra el 90 %
 * de para lo que existe una librería de fechas: transiciones de horario,
 * historial de desfases, horas locales ambiguas. Nada de eso puede pasar aquí.
 *
 * Y el truco que sobra casi todo lo demás: en `YYYY-MM-DD` **el orden
 * alfabético ES el cronológico**, así que comparar y ordenar fechas es comparar
 * y ordenar cadenas.
 *
 * Cuando `Temporal` llegue a Node, sustituye a la aritmética de aquí — no a
 * `Intl`, que ya hace lo suyo bien.
 */

/** `YYYY-MM-DD`. Es el tipo que viaja por la API. */
export type IsoDate = string;

const ZONA = 'America/Lima';

/**
 * HOY en Lima. `en-CA` da el formato ISO ya ordenado, que es lo que evita
 * montar la cadena a mano con `padStart`.
 *
 * El `timeZone` va SIEMPRE explícito: sin él, un visitante desde otro huso
 * vería un «hoy» distinto al de James, y el build corre en UTC — a partir de
 * las 19:00 de Lima el servidor ya está en el día siguiente.
 */
export const hoy = (ahora: Date = new Date()): IsoDate =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora);

/**
 * `Date` → `YYYY-MM-DD`. Solo vale para fechas de CALENDARIO, que llegan a
 * medianoche UTC: cualquier formateo local les resta cinco horas y devuelve el
 * día anterior. Ya pasó una vez con `eventDate`.
 */
export const aIso = (d: Date): IsoDate => d.toISOString().slice(0, 10);

/**
 * «sábado 24 de octubre». UTC porque es una fecha de calendario.
 *
 * Se le quita la coma que mete `Intl` («sábado, 24 de octubre»): esto acaba
 * dentro de una frase —«¿tienes libre el sábado, 24 de octubre?»— y ahí la coma
 * parte la lectura.
 */
export function largo(fecha: IsoDate): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(new Date(`${fecha}T00:00:00Z`))
    .replace(',', '');
}

/** «24 de octubre», sin el día de la semana. */
export function corto(fecha: IsoDate): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${fecha}T00:00:00Z`));
}

/**
 * «Octubre 2026», para la cabecera del calendario.
 *
 * `Intl` en español devuelve «octubre de 2026», que es correcto en una frase y
 * sobra en una cabecera: ahí es una etiqueta, no una oración. Se le quita el
 * «de» y se le pone la mayúscula.
 */
export function mesYAno(fecha: IsoDate): string {
  const s = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  })
    .format(new Date(`${fecha}T00:00:00Z`))
    .replace(' de ', ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «del 24 al 25 de octubre» · «del 30 de octubre al 2 de noviembre». */
export function rango(desde: IsoDate, hasta: IsoDate): string {
  if (desde === hasta) return `el ${largo(desde)}`;
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  const dia = (f: IsoDate) => String(Number(f.slice(8, 10)));
  return mismoMes ? `del ${dia(desde)} al ${corto(hasta)}` : `del ${corto(desde)} al ${corto(hasta)}`;
}

/** Suma días a una fecha de calendario, en UTC para no cruzar husos. */
export function masDias(fecha: IsoDate, dias: number): IsoDate {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return aIso(d);
}

/** Suma meses. Si el día no existe en el mes destino, cae al último. */
export function masMeses(fecha: IsoDate, meses: number): IsoDate {
  const [a, m, d] = fecha.split('-').map(Number);
  const destino = new Date(Date.UTC(a!, m! - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(d!, ultimo));
  return aIso(destino);
}

/**
 * La rejilla de un mes, empezando en LUNES (`es-PE`), con los huecos del mes
 * anterior y el siguiente para que las seis filas estén completas.
 */
export function rejillaDelMes(fecha: IsoDate): { dia: IsoDate; delMes: boolean }[] {
  const [a, m] = fecha.split('-').map(Number);
  const primero = new Date(Date.UTC(a!, m! - 1, 1));
  // getUTCDay(): 0 es domingo. `+6 % 7` lo convierte en «lunes = 0».
  const hueco = (primero.getUTCDay() + 6) % 7;
  const inicio = new Date(primero);
  inicio.setUTCDate(1 - hueco);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setUTCDate(inicio.getUTCDate() + i);
    return { dia: aIso(d), delMes: d.getUTCMonth() === m! - 1 };
  });
}

/** Iniciales de los días, de la propia `Intl` — nunca un array a mano. */
export const INICIALES_SEMANA = Array.from({ length: 7 }, (_, i) => {
  // 2026-01-05 fue lunes.
  const d = new Date(Date.UTC(2026, 0, 5 + i));
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', weekday: 'narrow' }).format(d);
});

/** «hace 2 días», para el «actualizado» del calendario. */
const RELATIVO = new Intl.RelativeTimeFormat('es-PE', { numeric: 'auto' });
const UNIDADES = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
] as const;

export function relativo(iso: string, ahora = Date.now()): string {
  const s = Math.round((new Date(iso).getTime() - ahora) / 1000);
  for (const [unidad, seg] of UNIDADES) {
    if (Math.abs(s) >= seg) return RELATIVO.format(Math.round(s / seg), unidad);
  }
  return 'hace un momento';
}

/**
 * Segundos → `m:ss`. Lo que se pinta en la esquina de cada reel.
 *
 * Sin ceros a la izquierda en los minutos —«0:42», no «00:42»— porque a 12px
 * en la esquina de una miniatura cada carácter cuenta, y nada de esto llega a
 * la hora: un aftermovie son tres minutos, no tres horas.
 */
export function duracion(segundos: number | null): string | null {
  if (segundos === null || !Number.isFinite(segundos) || segundos < 0) return null;
  const total = Math.round(segundos);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * «Quedan 3 sábados libres en octubre», o `null`.
 *
 * **Solo se dice si hay escasez de verdad**, es decir si ese mes tiene algún
 * sábado ya ocupado. Con el mes entero libre, «quedan 4 sábados libres» no da
 * urgencia: da exactamente la contraria, y encima es lo que verá un visitante
 * el primer día, cuando la tabla está vacía.
 *
 * Los SÁBADOS y no los días: una boda, unos XV y casi cualquier fiesta caen en
 * sábado, así que es el número que de verdad escasea. Contar los 31 días diría
 * «quedan 28 días libres» y no significa nada.
 */
export function sabadosLibres(
  ocupados: readonly IsoDate[],
  until: IsoDate,
  desde: IsoDate = hoy(),
): { texto: string; mes: string } | null {
  const tomados = new Set(ocupados);
  const [a, m] = desde.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(a!, m!, 0)).getUTCDate();

  let libres = 0;
  let ocupadosEnMes = 0;
  for (let d = Number(desde.slice(8)); d <= ultimoDia; d++) {
    const iso = `${desde.slice(0, 7)}-${String(d).padStart(2, '0')}`;
    // Más allá de `until` no se sabe: no cuenta ni como libre ni como ocupado.
    if (iso > until) break;
    if (new Date(`${iso}T00:00:00.000Z`).getUTCDay() !== 6) continue;
    if (tomados.has(iso)) ocupadosEnMes++;
    else libres++;
  }

  if (ocupadosEnMes === 0 || libres === 0) return null;

  // `Intl` en `es-PE` devuelve «Octubre» con mayúscula, y aquí va en medio de
  // una frase. Es el mismo apaño que `mesYAno`, y por la misma razón.
  const largoMes = new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', month: 'long' }).format(
    new Date(`${desde}T00:00:00.000Z`),
  );
  const mes = largoMes.charAt(0).toLowerCase() + largoMes.slice(1);
  return {
    texto: `quedan ${libres} ${libres === 1 ? 'sábado libre' : 'sábados libres'} en ${mes}`,
    mes,
  };
}
