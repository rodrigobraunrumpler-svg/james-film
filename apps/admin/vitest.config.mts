import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // Dos proyectos, no uno. La pasarela usa cookies() de next/headers, que fuera
    // de un ámbito de petición lanza: va en `nodo` con next/headers mockeado, y ahí
    // vive también la lógica pura de bytes. El `dom` es para componentes y hooks.
    //
    // happy-dom NO decodifica vídeo ni rasteriza canvas: loadedmetadata no dispara,
    // duration es NaN y toBlob no produce píxeles. Un test de poster ahí pasaría sin
    // comprobar nada, que es peor que no tenerlo. Eso va a Playwright y al iPhone.
    projects: [
      {
        extends: true,
        // `server-only` lanza si se importa fuera de un Server Component: es justo
        // su trabajo. Aquí se apunta a su propio módulo vacío —el que Next usa bajo
        // la condición `react-server`—, no se neutraliza el guardarraíl: el que de
        // verdad cuenta lo aplica `next build` sobre el bundle del cliente.
        resolve: {
          alias: { 'server-only': new URL('./src/lib/soporte/server-only-vacio.ts', import.meta.url).pathname },
        },
        test: {
          name: 'nodo',
          environment: 'node',
          include: [
            'src/lib/api/server/**/*.spec.ts',
            'src/app/api/**/*.spec.ts',
            'src/**/*.nodo.spec.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['src/**/*.dom.spec.{ts,tsx}'],
          setupFiles: ['./vitest.setup.dom.ts'],
        },
      },
    ],
  },
});
