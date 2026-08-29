import { expect, test, type Page } from '@playwright/test';
import { abrirPrimeraGaleria, irAlPanel } from './apoyo';

/** El síntoma que §7 prohíbe, medido y no mirado a ojo. */
const desbordaHorizontal = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

/** Las cuatro pantallas de la fase 4, además de las de la fase 3. */
const PANTALLAS = [
  { nombre: 'Galerías', ruta: '/' },
  { nombre: 'Categorías', ruta: '/categorias' },
  { nombre: 'Paquetes', ruta: '/paquetes' },
  { nombre: 'Testimonios', ruta: '/testimonios' },
  { nombre: 'Configuración', ruta: '/configuracion' },
];

test.describe('responsive', () => {
  test('a 320 px, ninguna pantalla de la fase 4 desborda', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await irAlPanel(page);

    for (const { nombre, ruta } of PANTALLAS) {
      await page.goto(ruta);
      await expect(page.getByRole('heading', { name: nombre, level: 1 })).toBeVisible();
      expect(await desbordaHorizontal(page), `${nombre} desborda a 320 px`).toBe(false);
    }
  });

  test('los objetivos táctiles de las pantallas nuevas llegan a 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await irAlPanel(page);

    for (const { ruta } of PANTALLAS) {
      await page.goto(ruta);
      for (const boton of await page.getByRole('button').all()) {
        if (!(await boton.isVisible())) continue;
        if (await boton.evaluate((el) => el.matches('input[type="file"]'))) continue;
        const caja = await boton.boundingBox();
        expect(caja?.height ?? 0, `botón bajo en ${ruta}`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('un texto largo en un paquete no rompe la tarjeta', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await irAlPanel(page);
    await page.goto('/paquetes');
    await expect(page.getByRole('heading', { name: 'Paquetes', level: 1 })).toBeVisible();

    // §7: los datos que escribe el usuario no pueden romper el layout.
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await page.getByLabel('Nombre').fill('X'.repeat(60));
    expect(await desbordaHorizontal(page)).toBe(false);
  });
  test('a 320 px no hay scroll horizontal en ninguna pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });

    await page.goto('/login');
    expect(await desbordaHorizontal(page)).toBe(false);

    await irAlPanel(page);
    expect(await desbordaHorizontal(page)).toBe(false);

    await abrirPrimeraGaleria(page);
    expect(await desbordaHorizontal(page)).toBe(false);
  });

  test('con zoom al 200% tampoco', async ({ page }) => {
    // Se emula reduciendo el viewport a la mitad: es lo que ve el navegador.
    await page.setViewportSize({ width: 320, height: 512 });
    await irAlPanel(page);
    await abrirPrimeraGaleria(page);

    expect(await desbordaHorizontal(page)).toBe(false);
  });

  test('en horizontal (568x320) el editor sigue usable', async ({ page }) => {
    await irAlPanel(page);
    await page.setViewportSize({ width: 568, height: 320 });
    await abrirPrimeraGaleria(page);

    expect(await desbordaHorizontal(page)).toBe(false);
    await expect(page.getByLabel('Título')).toBeVisible();
  });

  test('un título de 60 caracteres no rompe la tarjeta de la lista', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await irAlPanel(page);
    await abrirPrimeraGaleria(page);

    await page.getByLabel('Título').fill('X'.repeat(60));
    expect(await desbordaHorizontal(page)).toBe(false);

    await page.goto('/');
    await expect(page.getByRole('list')).toBeVisible();
    expect(await desbordaHorizontal(page)).toBe(false);
  });

  test('los objetivos táctiles llegan a 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await irAlPanel(page);
    await abrirPrimeraGaleria(page);

    for (const boton of await page.getByRole('button').all()) {
      if (!(await boton.isVisible())) continue;
      // El `<input type="file">` va `sr-only` (1 px) a propósito: quien se pulsa
      // es su botón visible, y ése sí se mide aquí. El árbol de accesibilidad
      // lo expone como «button», de ahí el filtro.
      if (await boton.evaluate((el) => el.matches('input[type="file"]'))) continue;
      const caja = await boton.boundingBox();
      // §7: es el pulgar de James en una pantalla pequeña, no una preferencia.
      expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
