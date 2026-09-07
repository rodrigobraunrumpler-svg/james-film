import { expect, test } from '@playwright/test';
import { unaGaleria } from './apoyo';

/**
 * SIN JAVASCRIPT LA WEB SIGUE SIRVIENDO.
 *
 * No es purismo: es que el negocio entero es un enlace. Si el CTA fuera un
 * `<button>` con listener, un bloqueador, una red que corta el bundle o un
 * navegador de dentro de Instagram se llevarían por delante la única
 * conversión que tiene esta web.
 */
test.use({ javaScriptEnabled: false });

test('se lee la portada entera y las secciones están', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText(/\w{4,}/);
  await expect(page.locator('#paquetes')).toBeAttached();
  /*
   * El calendario ya NO vive en la portada: tiene su propia página. Lo que la
   * portada tiene que garantizar sin JS es que se LLEGA a ella.
   *
   * `toBeVisible`, no `toBeAttached`: el enlace del menú móvil vive dentro de
   * un `<dialog>` que necesita JS para abrirse, y el de la barra de escritorio
   * va `hidden lg:flex`. Con «adjunto» bastaba, este test pasaba a 390px
   * mientras no había **ni un enlace pulsable** a `/fechas-libres/` — que es
   * justo lo que pasa en el navegador de dentro de Instagram. Lo resuelve el
   * pie, que ahora enlaza las páginas propias.
   */
  await expect(page.locator('a[href="/fechas-libres/"]').locator('visible=true').first()).toBeVisible();
});

test('los botones de WhatsApp son enlaces de verdad, con el mensaje ya escrito', async ({ page }) => {
  await page.goto('/');
  const enlaces = page.locator('[data-wa]');
  expect(await enlaces.count()).toBeGreaterThan(0);

  for (const a of await enlaces.all()) {
    const href = await a.getAttribute('href');
    expect(href, 'un CTA de WhatsApp sin href no funciona sin JS').toBeTruthy();
    expect(href!, `href raro: ${href}`).toMatch(/^https:\/\/wa\.me\/\d{10,}\?text=./);
    expect(await a.evaluate((el) => el.tagName), 'el CTA tiene que ser <a>, no <button>').toBe('A');
  }
});

test('la entrada por scroll no esconde nada cuando no hay JS', async ({ page }) => {
  await page.goto('/');
  // La regla es `:root.js .entra { opacity: 0 }`, y la clase `js` la pone el
  // script bloqueante. Sin JS no hay clase, así que no se esconde nada.
  await expect(page.locator('html')).not.toHaveClass(/\bjs\b/);
  const parrafo = page.locator('#paquetes').locator('..').locator('h2').first();
  await expect(parrafo).toBeVisible();
});

test('las galerías se navegan sin JS', async ({ page }) => {
  // Por el helper: `getAttribute` sobre un localizador vacío no devuelve `null`,
  // espera hasta el timeout — y con la base sin galerías eso se lee como código
  // roto en vez de como «no hay datos».
  const href = await unaGaleria(page);
  test.skip(!href, 'no hay galerías publicadas');
  await page.goto(href!);
  await expect(page.locator('h1')).toBeVisible();
});
