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
