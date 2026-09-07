import { expect, test } from '@playwright/test';
import { esperarAnimaciones, unaGaleria } from './apoyo';

/**
 * Contra el BUILD real. Lo que tiene que funcionar aunque se rompa todo lo
 * demás: entrar, entender qué se vende, y llegar a WhatsApp.
 */
test('la portada carga con un solo h1 y el CTA a la vista', async ({ page }) => {
  await page.goto('/');
  await esperarAnimaciones(page);

  /**
   * UN h1 por página. El hero estuvo duplicado —móvil y escritorio— y dejaba
   * dos en el documento, cada uno oculto en el ancho del otro.
   *
   * Se cuenta DENTRO de `main`: `astro preview` inyecta su barra de
   * herramientas, que trae cuatro `<h1>` propios («Audit», «Settings»…). Es el
   * mismo caso que el botón de dev de Next en el E2E del admin — un test que
   * pasa o falla según qué inyecte la herramienta es peor que no tenerlo.
   */
  expect(await page.locator('main h1').count(), 'una página, un h1').toBe(1);
  expect(
    await page.locator('h1').evaluateAll((els) =>
      // `closest()` NO cruza la frontera de un shadow root, y la barra de
      // Astro vive dentro de uno: sus cuatro `<h1>` daban un falso rojo.
      // Lo que separa el contenido de la herramienta es el ÁRBOL: si el
      // `getRootNode()` no es el documento, no es de la página.
      els.filter((e) => e.getRootNode() === document && !e.closest('main')).length,
    ),
    'ningún h1 de la página fuera de main',
  ).toBe(0);
  await expect(page.locator('main [data-wa]').first()).toBeVisible();
});

test('un paquete lleva a wa.me con SU mensaje y su packageId', async ({ page }) => {
  await page.goto('/#paquetes');
  const boton = page.locator('[data-wa][data-fuente="paquetes"]').first();
  await expect(boton).toBeVisible();

  const href = await boton.getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/\d{10,}\?text=./);
  // El texto sale de la BASE, no del código: si un día lo compone la web, el
  // botón de «Probar este número» del admin pasa a mentir.
  const texto = decodeURIComponent(new URL(href!).searchParams.get('text') ?? '');
  expect(texto.length, 'el mensaje no puede ir vacío').toBeGreaterThan(10);
  // Y lleva su paquete, que es lo que atribuye el clic en el panel.
  expect(await boton.getAttribute('data-paquete')).toBeTruthy();
});

test('una galería abre su visor y lo cierra sin dejar el vídeo sonando', async ({ page }) => {
  const galeria = await unaGaleria(page);
  test.skip(!galeria, 'no hay galerías publicadas');
  await page.goto(galeria!);

  const tesela = page.locator('[data-medio]:not([data-tipo="PHOTO"])').first();
  test.skip((await tesela.count()) === 0, 'esta galería no tiene vídeos');

  await tesela.click();
  await expect(page.locator('#visor')).toBeVisible();
  expect(await page.locator('#visor video').count()).toBe(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('#visor')).toBeHidden();
  // Se DESTRUYE, no se pausa: si no, sigue sonando con el diálogo cerrado y no
  // hay forma de callarlo desde la página.
  expect(await page.locator('#visor video').count()).toBe(0);
});

test('el filtro de trabajos esconde de verdad, no solo cambia el chip', async ({ page }) => {
  await page.goto('/trabajos');
  const chips = page.locator('[data-filtro]:not([data-filtro=""])');
  test.skip((await chips.count()) === 0, 'una sola categoría, no hay filtro');

  const antes = await page.locator('[data-rejilla] > a:visible').count();
  await chips.first().click();
  const despues = await page.locator('[data-rejilla] > a:visible').count();
  expect(despues).toBeLessThan(antes);
  expect(despues, 'un filtro que deja la rejilla vacía es una promesa rota').toBeGreaterThan(0);
});

test('los legales existen y se llega a los tres desde el pie', async ({ page }) => {
  await page.goto('/');
  for (const ruta of ['/privacidad/', '/terminos/', '/uso-de-imagen/']) {
    await expect(page.locator(`footer a[href="${ruta}"]`)).toHaveCount(1);
    const res = await page.request.get(ruta);
    expect(res.status(), `${ruta} no responde`).toBe(200);
  }
});
