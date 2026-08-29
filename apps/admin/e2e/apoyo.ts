import path from 'node:path';
import { expect, type Page } from '@playwright/test';

export const CREDENCIALES = {
  email: process.env.SEED_ADMIN_EMAIL ?? '',
  password: process.env.SEED_ADMIN_PASSWORD ?? '',
};

// `__dirname` y no `import.meta.url`: Playwright transpila los specs a
// CommonJS —apps/admin no es ESM— y ahí `import.meta` es un error de sintaxis.
export const REEL = path.join(__dirname, 'fixtures', 'reel.mp4');
export const REEL_HEVC = path.join(__dirname, 'fixtures', 'reel-hevc.mp4');
/**
 * El mismo `reel.mp4` con la caja `moov` movida AL FINAL —y los `stco`
 * corregidos, que si no el vídeo deja de decodificar—. Generado con el script
 * de `scripts/sin-faststart.mjs`, no con ffmpeg: aquí no está instalado.
 */
export const REEL_SIN_FASTSTART = path.join(__dirname, 'fixtures', 'reel-sin-faststart.mp4');

export const ESTADO_SESION = path.join(__dirname, '.auth', 'sesion.json');

/** Login de verdad. Lo usan el setup y el propio spec de login, nadie más. */
export async function entrar(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(CREDENCIALES.email);
  // `exact` porque `getByLabel` busca por SUBCADENA y el botón del ojo se
  // llama «Mostrar la contraseña»: sin esto son dos coincidencias.
  await page.getByLabel('Contraseña', { exact: true }).fill(CREDENCIALES.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Galerías' })).toBeVisible();
}

/**
 * Con la sesión ya puesta por `storageState`. El resto de specs entra por aquí:
 * repetir el login en cada test agota el límite de 5/min del endpoint —que es
 * correcto que exista— y el fallo parecería de credenciales.
 */
export async function irAlPanel(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Galerías' })).toBeVisible();
}

/** Abre la primera galería de la lista. El seed deja al menos una. */
export async function abrirPrimeraGaleria(page: Page): Promise<void> {
  // Se espera a que la lista tenga datos: `irAlPanel` solo garantiza el título
  // de la pantalla, que se pinta con el skeleton todavía puesto.
  await page.getByRole('list').getByRole('link').first().waitFor();
  await page.getByRole('list').getByRole('link').first().click();
  await expect(page.getByLabel('Título', { exact: true })).toBeVisible();
}

/**
 * Abre la primera galería que TENGA medios, y espera a que la grilla esté
 * pintada. `count()` no espera: llamarlo justo después de abrir devuelve 0 y el
 * test se salta solo, que es la peor forma de pasar.
 */
export async function abrirGaleriaConMedios(page: Page): Promise<boolean> {
  await page.getByRole('list').getByRole('link').first().waitFor();
  const enlaces = await page.getByRole('list').getByRole('link').all();

  for (const enlace of enlaces) {
    const texto = (await enlace.textContent()) ?? '';
    if (/(^|\D)0 medios/.test(texto)) continue;
    await enlace.click();
    await expect(page.getByLabel('Título', { exact: true })).toBeVisible();
    const teselas = page.getByRole('button', { name: /^Ver / });
    await teselas.first().waitFor({ timeout: 10_000 });
    return true;
  }
  return false;
}
