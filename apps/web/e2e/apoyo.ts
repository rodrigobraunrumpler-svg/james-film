import type { Locator, Page } from '@playwright/test';

/** Las cuatro plantillas que existen. Un slug real, no inventado. */
/**
 * Las rutas que barren `responsive.spec.ts` y `contraste.spec.ts` — nueve
 * anchos, dos temas, zoom al 200 %.
 *
 * Eran TRES de diez plantillas. `/fechas-libres`, `/negocios`, `/sobre-mi` y
 * `/testimonios` nunca habían pasado por la matriz, y son justo donde vive lo
 * que se ha ido añadiendo después: el calendario, el carrusel de paquetes, la
 * rejilla de testimonios. Meter un carrusel con margen negativo en una ruta sin
 * cobertura es exactamente cómo entró el fallo del `-mx-4` la otra vez.
 *
 * `/404` se queda fuera: `astro preview` la sirve con estado 404 y Playwright no
 * distingue eso de una ruta rota.
 */
export const RUTAS = [
  '/',
  '/trabajos',
  '/fechas-libres',
  '/negocios',
  '/sobre-mi',
  '/testimonios',
  '/uso-de-imagen',
] as const;

export const TEMAS = ['oscuro', 'claro'] as const;
export type Tema = (typeof TEMAS)[number];

/** El tema se fija ANTES de cargar: el script del `<head>` lee esta clave. */
export async function conTema(page: Page, tema: Tema): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem('jamesfilm:tema', t), tema);
}

/**
 * Medir o capturar espera a que ACABEN las animaciones, saltándose las
 * INFINITAS: la promesa de una que no termina nunca no resuelve, y el test
 * agota el timeout con un fallo que parece del test. Es la misma función que
 * el admin, por la misma razón: un botón de 48px bajo `scale(0.97)` mide 46,6
 * y falla por algo que no es un fallo.
 */
export async function esperarAnimaciones(objetivo: Page | Locator): Promise<void> {
  // `Page.evaluate` y `Locator.evaluate` tienen firmas distintas y su unión no
  // es invocable. Se estrecha aquí en vez de tipar el parámetro más flojo.
  const correr = (fn: () => Promise<void>) =>
    'goto' in objetivo ? (objetivo as Page).evaluate(fn) : (objetivo as Locator).evaluate(fn);
  await correr(async () => {
    const vivas = document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(vivas.map((a) => a.finished.catch(() => {})));
  });
}

/**
 * Se baja del todo y se espera a que la página deje de crecer.
 *
 * Hace falta porque la entrada de cada bloque va con `IntersectionObserver`:
 * medir sin haber bajado deja media página a opacidad 0, y el test de
 * contraste la saltaría en silencio creyendo que no hay nada que mirar.
 */
export async function recorrerEntera(page: Page): Promise<void> {
  let previo = -1;
  for (let i = 0; i < 25; i++) {
    const alto = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.8);
      return document.body.scrollHeight;
    });
    await page.waitForTimeout(160);
    if (alto === previo && (await page.evaluate(() => window.scrollY + window.innerHeight >= document.body.scrollHeight - 2))) break;
    previo = alto;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await esperarAnimaciones(page);
}

/** Una galería publicada de verdad, sacada del índice. No un slug inventado. */
export async function unaGaleria(page: Page): Promise<string | null> {
  await page.goto('/trabajos');
  /**
   * Se CUENTA antes de leer. `getAttribute()` sobre un localizador vacío no
   * devuelve `null`: espera a que aparezca y agota los 60 s del test, así que
   * con la base sin galerías publicadas tres tests fallaban por «timeout» —que
   * se lee como código roto— cuando lo que pasaba era que no había datos. Sus
   * llamadores ya saben saltarse el test con `null`; lo que faltaba era
   * devolvérselo.
   */
  const rejilla = page.locator('[data-rejilla] > a');
  // Sin esperas: la página es HTML estático, así que lo que no está al cargar
  // no va a estar nunca. Esperar aquí solo alarga el fallo hasta el timeout.
  if ((await rejilla.count()) === 0) return null;
  return rejilla.first().getAttribute('href');
}
