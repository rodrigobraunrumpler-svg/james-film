import { expect, test } from '@playwright/test';
import { esperarAnimaciones, unaGaleria } from './apoyo';

test('el enlace de salto existe, se ve al enfocarlo y lleva al contenido', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  const salto = page.locator('a[href="#contenido"]');
  await expect(salto).toBeFocused();
  // 1×1 mientras nadie lo enfoca; pulsable en cuanto se enfoca. Si al recibir
  // el foco siguiera midiendo 1×1, sería un enlace que solo existe en el DOM.
  const caja = await salto.boundingBox();
  expect(caja!.height, 'el enlace de salto enfocado tiene que poder pulsarse').toBeGreaterThanOrEqual(44);

  await page.keyboard.press('Enter');
  await expect(page.locator('#contenido')).toBeVisible();
});

test('el foco se ve en todo lo que se puede tabular', async ({ page }) => {
  await page.goto('/');
  await esperarAnimaciones(page);

  // Nadie quita el `outline` sin darse cuenta: se comprueba que el estilo del
  // foco existe de verdad, no que esté escrito en la hoja.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const visible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return true;
      const e = getComputedStyle(el);
      return (e.outlineStyle !== 'none' && parseFloat(e.outlineWidth) > 0) || e.boxShadow !== 'none';
    });
    expect(visible, `el elemento ${i + 1} del recorrido no marca el foco`).toBe(true);
  }
});

test('el visor se maneja entero con el teclado y devuelve el foco', async ({ page }) => {
  const galeria = await unaGaleria(page);
  test.skip(!galeria, 'no hay galerías publicadas');
  await page.goto(galeria!);

  const tesela = page.locator('[data-medio]').first();
  await tesela.focus();
  await page.keyboard.press('Enter');

  const visor = page.locator('#visor');
  await expect(visor).toBeVisible();
  // `showModal()` y no el atributo `open`: con `open` el tabulador se pasea
  // por la página de detrás. Se comprueba que el foco NO se escapa.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => document.getElementById('visor')!.contains(document.activeElement)),
    'el foco se escapó del diálogo: ¿se abrió con el atributo `open` en vez de showModal()?',
  ).toBe(true);

  await page.keyboard.press('Escape');
  await expect(visor).toBeHidden();
});
