/**
 * Parte el titular del hero en «lo normal» + «lo que va en latón».
 *
 * En latón va la ÚLTIMA palabra, y se calcula aquí en vez de escribirlo en el
 * texto porque el `tagline` lo edita James desde Configuración: meterle marcado
 * le obligaría a saber qué significan dos asteriscos para que su web no se
 * rompa.
 *
 * **La regla no es «la última palabra», es «la última IDEA».** Con «Reels de tu
 * evento, en 48 horas» la última palabra es «horas» y el resaltado dejaba el
 * «48» apagado — justo el número que hace el titular. Cuando el token anterior
 * es solo dígitos, se arrastra: «48 horas» entero.
 */
export interface Titular {
  inicio: string;
  final: string;
}

const SOLO_DIGITOS = /^\d+$/;

export function partirTitular(titular: string): Titular {
  const palabras = titular.trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return { inicio: '', final: titular.trim() };

  // Cuántas palabras se lleva el latón: una, o dos si la penúltima es un número.
  const cuantas = SOLO_DIGITOS.test(palabras[palabras.length - 2]!) ? 2 : 1;
  const final = palabras.slice(palabras.length - cuantas).join(' ');
  const inicio = palabras.slice(0, palabras.length - cuantas).join(' ');
  // El espacio va en `inicio` para que los dos trozos se peguen sin un `&nbsp;`.
  return { inicio: `${inicio} `, final };
}
