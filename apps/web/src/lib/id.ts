/**
 * Ids únicos para atar una etiqueta a su control (`aria-describedby`, `for`).
 *
 * Un contador y no `Math.random()`: el frontmatter de Astro corre en el BUILD,
 * así que un id aleatorio cambia el HTML en cada compilación aunque no se haya
 * tocado una línea. Eso invalida la caché del CDN sin motivo y convierte en
 * ruido cualquier comparación entre dos builds.
 *
 * Solo tiene que ser único DENTRO de un documento, y el módulo se evalúa una
 * vez por build: el orden de render de una web estática es estable, así que el
 * mismo código da siempre el mismo número.
 */
let n = 0;

export function idUnico(prefijo: string): string {
  n += 1;
  return `${prefijo}-${n}`;
}
