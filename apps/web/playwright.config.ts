import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

/**
 * `chromium` empaquetado por defecto, al revés que el admin.
 *
 * Allí hace falta Chrome de verdad porque subir un reel pasa por decodificar
 * H.264 en un canvas. Aquí no se sube nada: la landing solo lee. Y el
 * empaquetado no pide root para instalarse.
 */
export const CANAL = process.env.PW_CANAL === 'chrome' ? 'chrome' : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: 1,
  reporter: CI ? 'github' : 'list',
  timeout: 60_000,

  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'movil',
      use: { ...devices['Desktop Chrome'], channel: CANAL, viewport: { width: 390, height: 844 } },
    },
    {
      name: 'escritorio',
      testIgnore: /sin-js\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: CANAL, viewport: { width: 1440, height: 900 } },
    },
  ],

  /**
   * Se prueba contra el BUILD, no contra el `dev`. La landing es estática: lo
   * que se despliega es `dist/`, y `astro dev` transforma al vuelo con otro
   * pipeline. Probar el dev sería probar algo que nunca llega a producción.
   *
   * `reuseExistingServer` en local: si ya tienes un preview levantado, se usa.
   * Y ojo, el build necesita la API en el 3000 — sin ella aborta nombrando el
   * endpoint que falló.
   */
  webServer: {
    /**
     * El `sleep` del final NO sobra.
     *
     * `astro preview` de Astro 7 **daemoniza y vuelve** —el `status` lo dice:
     * «background»—, así que el comando termina con código 0 en cuanto forkea.
     * Playwright lo lee como «el servidor murió al empezar» y el error no
     * menciona ni a Astro ni al puerto: parece que el build falló. El proceso
     * de espera lo mantiene vivo mientras corren los tests.
     *
     * Y si algo se queda colgado, se para con `pnpm exec astro preview stop`,
     * **no** matando el pid: eso deja el registro del demonio y el siguiente
     * arranque se niega a levantar.
     */
    command:
      'pnpm build && pnpm exec astro preview --port 4321 && node -e "setInterval(() => {}, 1e9)"',
    url: 'http://localhost:4321',
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
