import { expect, test } from '@playwright/test';
import { CREDENCIALES, entrar } from './apoyo';

// El único spec que entra a mano: los demás reutilizan la sesión del setup.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('login', () => {
  test('entra con las credenciales del seed y llega al panel', async ({ page }) => {
    await entrar(page);
    await expect(page).toHaveURL('http://localhost:3001/');
  });

  test('una contraseña mala da el MISMO mensaje que un email inexistente', async ({ page }) => {
    // Si difirieran, el formulario diría qué emails existen.
    await page.goto('/login');
    await page.getByLabel('Email').fill(CREDENCIALES.email);
    await page.getByLabel('Contraseña').fill('no-es-la-buena');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // `p[role=alert]` y no getByRole('alert'): Next monta su propio anunciador
    // de ruta con ese rol y el localizador resolvería a dos elementos.
    const errorDelFormulario = page.locator('p[role="alert"]');
    await expect(errorDelFormulario).not.toBeEmpty();
    const conPasswordMala = await errorDelFormulario.textContent();

    await page.goto('/login');
    await page.getByLabel('Email').fill('nadie@jamesfilm.local');
    await page.getByLabel('Contraseña').fill('no-es-la-buena');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.locator('p[role="alert"]')).toHaveText(conPasswordMala ?? '');
  });

  test('sin sesión, una página redirige al login y la API devuelve 401', async ({ page, request }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    // proxy.ts protege PÁGINAS; de la API se ocupa la pasarela. Si /api entrara
    // en su matcher, un fetch() sin sesión seguiría el 307 y recibiría el HTML
    // del login donde espera JSON.
    const respuesta = await request.get('http://localhost:3001/api/admin/galleries');
    expect(respuesta.status()).toBe(401);
    expect(respuesta.headers()['content-type']).toContain('application/json');
  });
});
