import { expect, test } from '@playwright/test';
import { irAlPanel } from './apoyo';

test.describe('el buscador ⌘K', () => {
  test('se abre con el atajo desde CUALQUIER pantalla y lleva a otra', async ({ page }) => {
    await irAlPanel(page);
    await page.goto('/configuracion');
    await expect(page.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible();

    // Es lo que ata las pantallas: desde cualquier sitio a cualquier sitio sin
    // volver atrás. Aquí se prueba de verdad, con el navegador escuchando.
    await page.keyboard.press('ControlOrMeta+k');
    const caja = page.getByRole('textbox', { name: 'Buscar' });
    await expect(caja).toBeFocused();

    await caja.fill('bod');
    await page.getByRole('option', { name: /Bodas/ }).first().click();

    await expect(page).toHaveURL(/\/categorias/);
  });

  test('Escape lo cierra y ⌘K vuelve a abrirlo', async ({ page }) => {
    await irAlPanel(page);

    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('textbox', { name: 'Buscar' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Buscar' })).toBeHidden();

    // Si el `onClose` del <dialog> no avisara, el estado seguiría en «abierto»
    // y el atajo no volvería a funcionar.
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('textbox', { name: 'Buscar' })).toBeVisible();
  });

  test('pulsar fuera lo cierra: el backdrop es parte del propio <dialog>', async ({ page }) => {
    await irAlPanel(page);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('textbox', { name: 'Buscar' })).toBeVisible();

    await page.mouse.click(10, 10);
    await expect(page.getByRole('textbox', { name: 'Buscar' })).toBeHidden();
  });

  test('las flechas y Enter navegan sin tocar el ratón', async ({ page }) => {
    await irAlPanel(page);
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('textbox', { name: 'Buscar' }).fill('pro');

    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('textbox', { name: 'Buscar' })).toBeHidden();
  });

  test('el foco queda ATRAPADO dentro: es lo que da showModal() gratis', async ({ page }) => {
    await irAlPanel(page);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('textbox', { name: 'Buscar' })).toBeFocused();

    // Con el atributo `open` en vez de `showModal()`, el tabulador se pasearía
    // por el panel de detrás y el diálogo sería decorativo.
    await page.keyboard.press('Tab');
    const dentro = await page.evaluate(
      () => document.activeElement?.closest('dialog') !== null,
    );
    expect(dentro).toBe(true);
  });
});

test.describe('el panel', () => {
  test('se llega desde el menú y pinta el número de clics', async ({ page }) => {
    await irAlPanel(page);
    await page.getByRole('link', { name: /^Panel/ }).first().click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('James');
    const clics = page.getByLabel('Clics a WhatsApp');
    await expect(clics).toBeVisible();
    await expect(clics.getByText(/clics a WhatsApp/)).toBeVisible();
  });

  test('el menú marca «Panel» cuando estás en él, y no «Galerías»', async ({ page }) => {
    await irAlPanel(page);
    await page.goto('/panel');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('James');

    const menu = page.getByRole('navigation', { name: 'Principal' }).last();
    await expect(menu.getByRole('link', { name: /^Panel/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(menu.getByRole('link', { name: /^Galerías/ })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('descartar un aviso lo quita y NO vuelve al recargar', async ({ page }) => {
    await irAlPanel(page);
    await page.goto('/panel');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('James');

    const bloque = page.getByLabel('Requiere tu atención');
    if (!(await bloque.isVisible().catch(() => false))) test.skip();

    const descartar = bloque.getByRole('button', { name: /^Descartar:/ }).first();
    const cuantos = await bloque.getByRole('listitem').count();
    await descartar.click();

    await expect
      .poll(async () => (await bloque.isVisible()) ? bloque.getByRole('listitem').count() : 0)
      .toBeLessThan(cuantos);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('James');
    await expect
      .poll(async () => (await bloque.isVisible()) ? bloque.getByRole('listitem').count() : 0)
      .toBeLessThan(cuantos);
  });

  test('el atajo de nueva galería lleva a Galerías con el formulario abierto', async ({ page }) => {
    await irAlPanel(page);
    await page.goto('/panel');
    await page.getByLabel('Atajos').getByRole('link', { name: 'Nueva galería' }).click();

    await expect(page).toHaveURL(/nueva=1/);
  });
});

test.describe('categorías', () => {
  test('la tira del menú enseña el mismo orden que las tarjetas', async ({ page }) => {
    await irAlPanel(page);
    await page.goto('/categorias');
    await expect(page.getByRole('heading', { name: 'Categorías', level: 1 })).toBeVisible();

    const tira = page.getByRole('region', { name: 'Menú de la web' });
    await expect(tira).toBeVisible();

    const enLaTira = await tira.getByRole('listitem').allTextContents();
    const enLasTarjetas = await page.getByRole('heading', { level: 3 }).allTextContents();
    expect(enLaTira).toEqual(enLasTarjetas);
  });

  test('mover una categoría cambia la tira AL MOMENTO', async ({ page }) => {
    await irAlPanel(page);
    await page.goto('/categorias');
    const tira = page.getByRole('region', { name: 'Menú de la web' });
    await expect(tira).toBeVisible();

    const antes = await tira.getByRole('listitem').allTextContents();
    await page.getByRole('button', { name: `Mover ${antes[0]} después` }).click();

    await expect
      .poll(() => tira.getByRole('listitem').allTextContents())
      .toEqual([antes[1], antes[0], ...antes.slice(2)]);

    // Se deja como estaba: el resto de tests cuenta con el orden del seed.
    await page.getByRole('button', { name: `Mover ${antes[0]} antes` }).click();
    await expect.poll(() => tira.getByRole('listitem').allTextContents()).toEqual(antes);
  });

  test('el menú de la tarjeta se CIERRA al pulsar fuera', async ({ page }) => {
    await irAlPanel(page);
    await page.goto('/categorias');
    await expect(page.getByRole('heading', { name: 'Categorías', level: 1 })).toBeVisible();

    // `<details>` no hace esto: abrirlo y tocar en otro sitio lo dejaba abierto
    // tapando la tarjeta de al lado. Por eso es un Popover de Radix.
    await page.getByRole('button', { name: /^Más acciones para/ }).first().click();
    await expect(page.getByRole('button', { name: /Ocultar de la web|Mostrar en la web/ })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: /Ocultar de la web|Mostrar en la web/ }),
    ).toBeHidden();
  });
});

test.describe('configuración', () => {
  test('la vista previa cambia al escribir, sin guardar', async ({ page }) => {
    await irAlPanel(page);
    await page.goto('/configuracion');
    await expect(page.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible();

    const previa = page.getByLabel('Vista previa de la web');
    await expect(previa).toBeVisible();

    await page.getByLabel('Frase corta').fill('Bodas en Ayacucho, en 48 horas');
    await expect(previa.getByText('Bodas en Ayacucho, en 48 horas')).toBeVisible();

    // No se guarda: se descarta para no dejar la base tocada.
    await page.getByRole('button', { name: 'Descartar' }).click();
  });

  test('Guardar arranca deshabilitado y se habilita al tocar algo', async ({ page }) => {
    await irAlPanel(page);
    await page.goto('/configuracion');
    const guardar = page.getByRole('button', { name: 'Guardar' });
    await expect(guardar).toBeDisabled();

    await page.getByLabel('Frase corta').fill('otra cosa');
    await expect(guardar).toBeEnabled();
    await page.getByRole('button', { name: 'Descartar' }).click();
    await expect(guardar).toBeDisabled();
  });
});
