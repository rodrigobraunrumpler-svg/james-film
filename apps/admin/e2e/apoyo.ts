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

export const ESTADO_SESION = path.join(__dirname, '.auth', 'sesion.json');

/** Login de verdad. Lo usan el setup y el propio spec de login, nadie más. */
export async function entrar(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(CREDENCIALES.email);
  await page.getByLabel('Contraseña').fill(CREDENCIALES.password);
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
  await page.getByRole('list').getByRole('link').first().click();
  await expect(page.getByLabel('Título')).toBeVisible();
}
