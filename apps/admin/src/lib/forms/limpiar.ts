/**
 * Un `<input>` vacío da `''`, nunca `null`. Y en un `PATCH`, `''` y `null` no
 * son lo mismo para la API: **`null` BORRA y omitir el campo NO TOCA**.
 *
 * Mandar `''` guardaría una cadena vacía donde el resto del proyecto usa
 * `null`, y omitirlo dejaría el valor viejo en la base para siempre — que es la
 * versión de este fallo que se ve desde fuera: James borra la descripción, la
 * pantalla dice «Guardado» y al recargar sigue ahí.
 *
 * Se usa en TODOS los formularios del admin. Son cuatro pantallas y el que se
 * olvide no dará ningún error.
 */
export const vacioANull = (v: string | null | undefined): string | null =>
  v === undefined || v === null || v.trim() === '' ? null : v.trim();

/**
 * Lo mismo sobre un objeto entero: cada cadena vacía pasa a `null` y el resto
 * se deja intacto. `undefined` se conserva —significa «no toca este campo»— y
 * los no-cadena no se tocan, así que un `0`, un `false` o un array sobreviven.
 */
export function limpiar<T extends Record<string, unknown>>(datos: T): T {
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(datos)) {
    salida[clave] = typeof valor === 'string' ? vacioANull(valor) : valor;
  }
  return salida as T;
}
