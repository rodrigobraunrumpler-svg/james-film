/**
 * Mueve un elemento de una posición a otra sin mutar el array original.
 *
 * Vive en `lib` y no en una feature porque lo usan las cuatro pantallas
 * ordenables. Se sube AHORA, y no en la extracción del Task 6, porque es una
 * función pura de seis líneas: lo que espera a tener tres pantallas escritas es
 * el HOOK de reorden, que carga con la clave de caché, el debounce y la
 * reversión — y ahí sí hace falta ver qué varía antes de generalizar.
 */
export function mover<T>(lista: T[], desde: number, hasta: number): T[] {
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= lista.length || hasta >= lista.length) {
    return lista;
  }
  const copia = [...lista];
  const [elemento] = copia.splice(desde, 1);
  copia.splice(hasta, 0, elemento);
  return copia;
}
