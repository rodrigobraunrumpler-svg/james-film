/**
 * Módulo vacío al que apuntan los tests en lugar de `server-only`.
 *
 * `server-only` lanza al importarse fuera de un Server Component: es justo su
 * trabajo, y en Vitest no hay React del lado servidor. Su `exports` solo expone
 * `.`, así que no se puede apuntar a su propio `empty.js`.
 *
 * Esto NO desactiva el guardarraíl: el que cuenta lo aplica `next build` sobre el
 * bundle del cliente, y ahí `server-only` sigue intacto.
 */
export {};
