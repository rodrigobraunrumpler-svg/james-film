import { test, type Page } from '@playwright/test';
import { asegurarGaleriaConMedios, esperarAnimaciones, irAlPanel, REEL } from './apoyo';

/**
 * NO es un test: es la herramienta para MIRAR las pantallas y compararlas con
 * el prototipo. No afirma nada, así que se salta salvo que se pida a mano con
 * `PW_CAPTURA=1`. Vive aquí y no en un script suelto porque Playwright ya
 * levanta la API y el admin y ya trae la sesión en `storageState`.
 */
test.describe('capturas', () => {
  test.skip(!process.env.PW_CAPTURA, 'solo con PW_CAPTURA=1');

  const salida = process.env.PW_SALIDA ?? 'test-results/capturas';

  /** Fija el tema ANTES de navegar, como haría el script del <head>. */
  const conTema = async (page: Page, tema: 'claro' | 'oscuro') => {
    await page.addInitScript((t) => {
      window.localStorage.setItem('jamesfilm:tema', t);
    }, tema);
  };

  test('captura en claro', async ({ page }) => {
    await conTema(page, 'claro');
    await page.setViewportSize({ width: 1440, height: 900 });
    await irAlPanel(page);
    for (const [ruta, nombre, ancla] of [
      ['/panel', 'claro-panel', 'Clics a WhatsApp'],
      ['/', 'claro-galerias', null],
      ['/categorias', 'claro-categorias', 'Menú de la web'],
      ['/paquetes', 'claro-paquetes', null],
      ['/testimonios', 'claro-testimonios', null],
      ['/configuracion?pestana=contacto', 'claro-ajustes', 'Vista previa de la web'],
    ] as const) {
      await page.goto(ruta);
      if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
      else await page.getByRole('heading', { level: 1 }).waitFor();
      await esperarAnimaciones(page);
      await page.screenshot({ path: `${salida}/${nombre}.png` });
    }
  });

  test('captura movil en claro', async ({ page }) => {
    await conTema(page, 'claro');
    await page.setViewportSize({ width: 390, height: 844 });
    await irAlPanel(page);
    for (const [ruta, nombre, ancla] of [
      ['/panel', 'claro-movil-panel', 'Clics a WhatsApp'],
      ['/', 'claro-movil-galerias', null],
      ['/configuracion?pestana=identidad', 'claro-movil-ajustes', null],
    ] as const) {
      await page.goto(ruta);
      if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
      else await page.getByRole('heading', { level: 1 }).waitFor();
      await esperarAnimaciones(page);
      await page.screenshot({ path: `${salida}/${nombre}.png` });
    }
  });

  for (const [ruta, nombre, ancla] of [
    ['/panel', 'panel', 'Clics a WhatsApp'],
    ['/categorias', 'categorias', 'Menú de la web'],
    ['/configuracion?pestana=contacto', 'configuracion', 'Vista previa de la web'],
    ['/configuracion?pestana=identidad', 'ajustes-identidad', 'Vista previa de la web'],
    ['/configuracion?pestana=diferenciadores', 'ajustes-diferenciadores', 'Vista previa de los diferenciadores'],
    ['/configuracion?pestana=seo', 'ajustes-seo', 'Vista previa del SEO'],
    ['/testimonios', 'testimonios', null],
  ] as const) {
    test(`captura ${nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await irAlPanel(page);
      await page.goto(ruta);
      if (ancla) await page.getByLabel(ancla).first().waitFor();
      else await page.getByRole('heading', { level: 1 }).waitFor();
      await esperarAnimaciones(page);
      await page.screenshot({ path: `${salida}/${nombre}.png`, fullPage: true });
    });
  }

  test('captura sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await irAlPanel(page);
    await page.getByRole('link').first().waitFor();
    await esperarAnimaciones(page);

    // Abajo del todo: el sidebar tiene que seguir donde estaba.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Cerrar sesión' }).hover();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${salida}/sidebar-abajo.png` });
  });

  test('captura buscador', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await irAlPanel(page);
    await page.goto('/panel');
    await page.getByLabel('Clics a WhatsApp').waitFor();
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('textbox', { name: 'Buscar' }).fill('cam');
    await page.getByRole('option').first().waitFor();
    await esperarAnimaciones(page);
    await page.screenshot({ path: `${salida}/buscador.png` });
  });

  /**
   * SIN `fullPage`. El layout usa `min-h-dvh`, y `fullPage` redimensiona el
   * viewport a la altura del contenido: `dvh` crece con él y la página se
   * estira sola, dejando media captura en blanco. Se toman dos tiros por
   * pantalla, arriba y abajo, que es lo que se ve de verdad.
   */
  test('captura movil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await irAlPanel(page);
    // Se espera al CONTENIDO, no al `h1`: el titular se pinta con el skeleton
    // todavía puesto, y las animaciones de entrada de las tarjetas arrancan
    // cuando llegan los datos — o sea, después de esperar al titular.
    for (const [ruta, nombre, ancla] of [
      ['/panel', 'movil-panel', 'Clics a WhatsApp'],
      ['/categorias', 'movil-categorias', 'Menú de la web'],
      ['/configuracion?pestana=contacto', 'movil-configuracion', 'Vista previa de la web'],
    ] as const) {
      await page.goto(ruta);
      await page.getByLabel(ancla).first().waitFor();
      await esperarAnimaciones(page);
      await page.screenshot({ path: `${salida}/${nombre}.png` });
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${salida}/${nombre}-2.png` });
    }
  });

  test('drawer a 320 en los dos temas', async ({ page }) => {
    for (const tema of ['claro', 'oscuro'] as const) {
      await page.addInitScript((t) => {
        window.localStorage.setItem('jamesfilm:tema', t);
      }, tema);
      await page.setViewportSize({ width: 320, height: 640 });
      await irAlPanel(page);
      await page.getByRole('button', { name: 'Abrir menú' }).click();
      await esperarAnimaciones(page);
      await page.screenshot({ path: `${salida}/drawer-320-${tema}.png` });
    }
  });

  test('sin conexion en los dos temas', async ({ page, context }) => {
    for (const tema of ['claro', 'oscuro'] as const) {
      await page.addInitScript((t) => {
        window.localStorage.setItem('jamesfilm:tema', t);
      }, tema);
      await page.setViewportSize({ width: 900, height: 900 });
      await irAlPanel(page);
      await asegurarGaleriaConMedios(page);

      await page.setInputFiles('input[type="file"]', REEL);
      await page.getByRole('button', { name: 'Subir el archivo' }).click();
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));

      await page.getByRole('status').first().waitFor({ timeout: 15_000 });
      await esperarAnimaciones(page);
      await page.screenshot({ path: `${salida}/sin-conexion-${tema}.png` });

      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
    }
  });
});
