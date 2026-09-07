import { defineConfig } from 'vitest/config';

/**
 * `pnpm test` aquí es SOLO lo que corre en Node.
 *
 * Sin esta config, Vitest coge su patrón por defecto y se lleva por delante
 * `e2e/*.spec.ts`, que son de Playwright: ocho ficheros en rojo con los cuatro
 * de verdad en verde, así que el comando estaba roto y no lo miraba nadie.
 * El sufijo `.nodo.spec.ts` ya distinguía los dos mundos; ahora también lo
 * distingue el runner.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.nodo.spec.ts'],
  },
});
