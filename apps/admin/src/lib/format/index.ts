/**
 * Todo con `Intl`, sin librería de fechas: Perú es UTC-5 fijo, SIN horario de
 * verano, lo que elimina de raíz la clase de problemas que justifica luxon o
 * date-fns-tz. Ver CLAUDE.md.
 *
 * `timeZone` SIEMPRE explícito: la máquina de desarrollo está en America/Lima y
 * el contenedor de producción en UTC, así que el mismo código sin él daría días
 * distintos en cada sitio.
 */
const LOCALE = 'es-PE';

const fmtFecha = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', dateStyle: 'long' });
const fmtFechaHora = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'America/Lima',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const fmtMoneda = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'PEN' });
const fmtRelativo = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/** Fecha de CALENDARIO (`@db.Date`). En Lima restaría 5 h y mostraría el día anterior. */
export const fecha = (v: string | Date | null | undefined): string =>
  v ? fmtFecha.format(new Date(v)) : '—';

/** Instante real (`createdAt`, `updatedAt`): se muestra en la hora de James. */
export const fechaHora = (v: string | Date | null | undefined): string =>
  v ? fmtFechaHora.format(new Date(v)) : '—';

/**
 * `Intl` mete un espacio DURO (U+00A0) entre el símbolo y el número. Se normaliza
 * a un espacio normal: si no, cualquier aserción de test o de Playwright que
 * escriba "S/ 300.00" a mano falla comparando dos cadenas que se ven idénticas.
 */
export const moneda = (centimos: number | null | undefined): string =>
  centimos === null || centimos === undefined
    ? '—'
    : fmtMoneda.format(centimos / 100).replace(/\u00a0/g, ' ');

const UNIDADES = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
] as const;

/** "hace 4 minutos", "hace 3 días". Las cadenas exactas que pide §9. */
export function relativo(v: string | Date, ahora: number = Date.now()): string {
  const instante = new Date(v).getTime();
  // Una fecha ilegible devuelve cadena vacía en vez de reventar: `Intl` lanza
  // con NaN, y ese throw sale del render y se lleva la pantalla ENTERA al
  // error boundary por un solo campo mal formado en una sola tarjeta.
  if (!Number.isFinite(instante)) return '';
  const segundos = Math.round((instante - ahora) / 1000);
  for (const [unidad, enSegundos] of UNIDADES) {
    if (Math.abs(segundos) >= enSegundos || unidad === 'second') {
      return fmtRelativo.format(Math.round(segundos / enSegundos), unidad);
    }
  }
  return '';
}

/**
 * Segundos → `1:12`. Los segundos van siempre a dos dígitos: `1:7` se lee como
 * un minuto y siete, no como uno cero siete.
 */
export function duracion(segundos: number | null | undefined): string | null {
  if (segundos === null || segundos === undefined) return null;
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "35 MB". James necesita saber cuánto va a subir antes de empezar. */
export function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/**
 * Soles ENTEROS → céntimos. Con enteros `300 * 100` es exacto y no hay
 * `3009.9999` que redondear; el `Math.round` está por si llega un decimal
 * desde un `<input type="number">`, que acepta lo que le teclees.
 */
export const aCentimos = (soles: number): number => Math.round(soles * 100);

/** Céntimos → soles enteros, para rellenar el formulario. */
export const aSoles = (centimos: number | null | undefined): number | undefined =>
  centimos === null || centimos === undefined ? undefined : Math.round(centimos / 100);
