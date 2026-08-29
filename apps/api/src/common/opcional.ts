/**
 * En todo `PATCH`: **`null` BORRA, `undefined` NO TOCA.**
 *
 * Prisma ya lo respeta si el valor pasa tal cual. El problema aparece cuando
 * hay que TRANSFORMARLO, porque las dos formas naturales de escribirlo colapsan
 * los dos casos en uno:
 *
 * ```ts
 * eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined  // null → «no tocar»
 * name:      dto.name?.trim()                                     // null → undefined, igual
 * ```
 *
 * Las dos convierten «bórralo» en «déjalo como está». Y el modo de fallo es el
 * peor que hay: la interfaz dice «Guardado» y el dato reaparece al recargar.
 * Nada falla y nada se registra.
 *
 * Verificado: `null?.trim()` devuelve `undefined`, no `null`.
 */
export function mapear<T, U>(
  valor: T | null | undefined,
  transformar: (v: T) => U,
): U | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  return transformar(valor);
}

/**
 * `YYYY-MM-DD` → medianoche UTC, que es lo que `@db.Date` guarda sin desfase.
 * Formatearla en Lima restaría 5 horas y mostraría el día anterior.
 */
export const fechaDeCalendario = (v: string | null | undefined): Date | null | undefined =>
  mapear(v, (iso) => new Date(iso));

/**
 * Recorta, y una cadena que se queda vacía se guarda como `null`.
 *
 * Guardar `''` daría dos representaciones distintas de «vacío» sobre la misma
 * columna: la landing las pinta igual —ambas son falsy— pero cualquier consulta
 * que filtre por `null` se dejaría fuera las que quedaron en `''`.
 */
export const textoLimpio = (v: string | null | undefined): string | null | undefined =>
  mapear(v, (s) => s.trim() || null);
