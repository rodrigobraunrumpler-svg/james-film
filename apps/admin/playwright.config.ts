import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

/**
 * `chrome` de verdad por defecto. `PW_CANAL=chromium` existe para una máquina
 * donde no se pueda instalar Chrome (hace falta root): entonces todo corre
 * MENOS el flujo de subida, que se salta solo en vez de fallar con un error que
 * parecería del validador.
 */
export const CANAL = (process.env.PW_CANAL ?? 'chrome') as 'chrome' | 'chromium';

const ESTADO_SESION = path.join(__dirname, 'e2e', '.auth', 'sesion.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: 1,
  reporter: CI ? 'github' : 'list',
  timeout: 60_000,

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { channel: CANAL } },
    {
      name: 'chrome',
      testIgnore: /responsive(-total)?\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: ESTADO_SESION,
        // Canal `chrome`, NO el Chromium empaquetado: ese no trae códecs
        // propietarios, y «subir un reel» pasa por extraerPoster, que necesita
        // decodificar H.264. Con el canal por defecto falla siempre y el error
        // PARECE del validador. No hay salida por WebM: MIMES_VIDEO es solo mp4.
        channel: CANAL,
      },
    },
    {
      // El checklist responsive de §7, automatizado en lo que se puede: 320 px
      // sin scroll horizontal es medible, y es donde se rompe primero.
      //
      // Viewport de iPhone sobre Chrome, NO `devices['iPhone SE']`: ese
      // descriptor arrastra WebKit y el canal de Chrome no le vale. El Safari
      // real se prueba en el iPhone de James, no aquí.
      name: 'movil',
      testMatch: /responsive(-total)?\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        channel: CANAL,
        viewport: { width: 375, height: 667 },
        storageState: ESTADO_SESION,
      },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter api start',
      url: 'http://localhost:3000/galleries',
      // El login limita a 5 intentos por minuto, y hace bien. La suite entra
      // una sola vez, pero dos ejecuciones seguidas lo agotarían y el fallo
      // parecería de credenciales. El límite tiene su propio test de integración.
      env: { RATE_LIMIT_ENABLED: 'false' },
      reuseExistingServer: !CI,
      timeout: 120_000,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter admin start',
      url: 'http://localhost:3001/login',
      reuseExistingServer: !CI,
      timeout: 120_000,
      cwd: '../..',
    },
  ],
});
