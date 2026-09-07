import type { PackageDto } from '@james-film/contracts';

/**
 * Lo que dos bloques necesitaban saber de los paquetes, en un solo sitio.
 *
 * Vivía dentro de `Paquetes.astro`, y en cuanto `/fechas-libres` empezó a
 * ordenarlos por su cuenta aparecieron **dos reglas distintas para lo mismo**:
 * allí se ordenaba con `(a.priceAmount ?? 0) - (b.priceAmount ?? 0)`, que manda
 * un paquete sin precio al PRIMER puesto, y aquí al último. Hoy no se nota
 * porque los tres tienen precio; el día que James cree uno «a medida», los dos
 * bloques de la misma página lo ponen en extremos opuestos.
 */

/**
 * Ordenados por PRECIO, no por el `order` del panel.
 *
 * La regla del acento único —Básico neutro → Pro latón → Premium hueso— es una
 * ESCALERA de precio: solo se lee si están de menor a mayor. Con el `order`, un
 * reordenado desde el panel deja el «más vendido» el primero y la escalera deja
 * de significar nada. Los que no tienen precio van AL FINAL: no participan de
 * ella, y ponerlos delante haría que la escalera empezara por un hueco.
 */
export function enEscalera(paquetes: PackageDto[]): PackageDto[] {
  return [...paquetes].sort((a, b) => {
    if (a.priceAmount === null) return b.priceAmount === null ? 0 : 1;
    if (b.priceAmount === null) return -1;
    return a.priceAmount - b.priceAmount;
  });
}

/** «S/ 300» desde céntimos. `null` si el paquete no tiene precio. */
export function precio(p: PackageDto): string | null {
  return p.priceAmount === null ? null : soles(p.priceAmount, p.currency);
}

/**
 * El formateador, suelto: el hero necesita el número sin tener el paquete.
 *
 * Los céntimos deciden los decimales, y no es un capricho: con
 * `minimumFractionDigits: 0` fijo, S/ 300,50 salía como **«S/ 300.5»** — dinero
 * con un solo decimal, que se lee como un error de la web antes que como un
 * precio. Y poner 2 siempre daría «S/ 300.00» en los tres paquetes del flyer,
 * que son redondos: dos ceros que no dicen nada ocupando el sitio del número.
 *
 * O sea: redondo se escribe entero, y con céntimos se escriben los dos.
 */
export function soles(centimos: number, moneda = 'PEN'): string {
  const redondo = centimos % 100 === 0;
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: moneda || 'PEN',
    minimumFractionDigits: redondo ? 0 : 2,
    maximumFractionDigits: redondo ? 0 : 2,
  }).format(centimos / 100);
}

/**
 * El «hueso» es el MÁS CARO, no el último del array.
 *
 * Mirar la posición funcionaba solo porque el seed los devuelve en orden. En
 * cuanto se reordenan desde el panel —o los tests mueven el `order`, que ya
 * pasó— el acento más alto se lo lleva el que toque.
 */
export function masCaroDe(paquetes: PackageDto[]): PackageDto | null {
  return paquetes.reduce<PackageDto | null>(
    (max, p) =>
      p.priceAmount !== null && (max === null || p.priceAmount > (max.priceAmount ?? 0)) ? p : max,
    null,
  );
}

/**
 * El precio MÁS BAJO, para el «desde S/ 300» del hero. `null` sin paquetes con
 * precio.
 *
 * Ojo con la trampa: `Math.min(...[])` devuelve `Infinity`, no `null`, así que
 * la lista vacía se descarta ANTES de reducir. Sin esa guarda el hero diría
 * «Paquetes desde S/ ∞».
 */
export function desdeCuanto(paquetes: PackageDto[]): string | null {
  const conPrecio = paquetes.filter((p) => p.priceAmount !== null);
  if (conPrecio.length === 0) return null;
  const barato = conPrecio.reduce((min, p) => (p.priceAmount! < min.priceAmount! ? p : min));
  return precio(barato);
}
