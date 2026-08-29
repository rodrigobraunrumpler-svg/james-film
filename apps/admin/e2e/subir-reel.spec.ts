import { expect, test } from '@playwright/test';
import { abrirPrimeraGaleria, irAlPanel, REEL, REEL_HEVC, REEL_SIN_FASTSTART } from './apoyo';

/**
 * Se comprueba la CAPACIDAD, no el canal. El plan daba por hecho que el
 * Chromium empaquetado no trae códecs propietarios; medido en Playwright
 * 1.62 devuelve `probably` para avc1 —se descarga un bundle de ffmpeg aparte—
 * así que la suite corre también sin Chrome instalado.
 *
 * Si algún día dejara de decodificar, este test se salta con su motivo en vez
 * de fallar con un error que PARECERÍA del validador.
 */
test.beforeEach(async ({ page }) => {
  const puede = await page.evaluate(() =>
    document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'),
  );
  test.skip(puede === '', 'Este navegador no decodifica H.264: extraerPoster no puede funcionar');
});

test.describe('subir un reel', () => {
  test.beforeEach(async ({ page }) => {
    await irAlPanel(page);
    await abrirPrimeraGaleria(page);
  });

  test('un MP4/H.264 se valida, se sube a R2 y queda listo', async ({ page }) => {
    // Es el flujo entero: el canvas decodifica H.264, el poster sale JPEG,
    // presign, PUT directo al bucket, PUT del poster y confirm con HEAD. Nada
    // de esto se puede probar en happy-dom, que ni decodifica ni rasteriza.
    const puts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT') puts.push(new URL(r.url()).host);
    });

    // Contar ANTES: si no, la aserción la satisfacen las tarjetas que ya había
    // de una ejecución anterior y el test pasa sin haber subido nada.
    const tarjetas = page.getByRole('listitem');
    const antes = await tarjetas.count();

    await page.setInputFiles('input[type="file"]', REEL);
    await expect(page.getByText(/1 archivo · /)).toBeVisible();
    await page.getByRole('button', { name: 'Subir el archivo' }).click();

    await expect.poll(() => tarjetas.count(), { timeout: 60_000 }).toBe(antes + 1);
    await expect(page.getByText('No se pudo subir')).toHaveCount(0);
    // La barra de progreso del layout desaparece cuando ya no queda nada vivo.
    await expect(page.getByText(/^Subiendo /)).toHaveCount(0, { timeout: 60_000 });

    // El archivo va DIRECTO al bucket: por la API no pasa un solo byte.
    expect(puts.filter((h) => h.includes('9000')).length).toBeGreaterThanOrEqual(1);
    expect(puts.some((h) => h.includes('3001') || h.includes('3000'))).toBe(false);
  });

  test('un MP4 sin faststart SÍ se sube, y solo avisa', async ({ page }) => {
    // Un HEVC no lo reproduce media web: eso sí bloquea. Sin faststart el vídeo
    // se ve perfectamente, solo tarda más el primer play — y bloquearlo dejaba
    // a James sin salida si su editor no ofrece esa opción.
    const tarjetas = page.getByRole('listitem');
    const antes = await tarjetas.count();

    await page.setInputFiles('input[type="file"]', REEL_SIN_FASTSTART);
    await page.getByRole('button', { name: 'Subir el archivo' }).click();

    // Llega a R2: si el fixture estuviera corrupto —los `stco` sin corregir al
    // mover el `moov`— la extracción del póster fallaría y esto no pasaría.
    await expect.poll(() => tarjetas.count(), { timeout: 60_000 }).toBe(antes + 1);
    await expect(page.getByText('No se pudo subir')).toHaveCount(0);
    await expect(page.getByText(/inicio rápido|optimizar para web/).first()).toBeVisible();
  });

  test('un HEVC se rechaza ANTES de subir un byte', async ({ page }) => {
    // El iPhone lo reproduce, así que «el navegador puede con él» no vale de
    // criterio: se detecta por el FourCC de la cabecera.
    const subidas: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT') subidas.push(r.url());
    });

    await page.setInputFiles('input[type="file"]', REEL_HEVC);
    await page.getByRole('button', { name: 'Subir el archivo' }).click();

    const error = page.getByRole('alert').filter({ hasText: /HEVC|H\.264/ });
    await expect(error).toBeVisible({ timeout: 30_000 });
    // Y el mensaje dice qué hacer, no «formato inválido».
    // Lo que importa es que diga QUÉ HACER, no que nombre una aplicación:
    // James puede haber exportado desde cualquier editor.
    await expect(error).toContainText('H.264');
    expect(subidas).toHaveLength(0);
  });

  test('cancelar a mitad no deja una tarjeta muerta en la grilla', async ({ page }) => {
    // Se frena el PUT a propósito: sin esto la subida termina antes de que dé
    // tiempo a pulsar Cancelar y el test se saltaría siempre.
    await page.route('**/jamesfilm/**', async (ruta) => {
      await new Promise((r) => setTimeout(r, 10_000));
      await ruta.continue();
    });

    const tarjetas = page.getByRole('listitem');
    const antes = await tarjetas.count();

    await page.setInputFiles('input[type="file"]', REEL);
    await page.getByRole('button', { name: 'Subir el archivo' }).click();

    const cancelar = page.getByRole('button', { name: 'Cancelar' }).first();
    await expect(cancelar).toBeVisible({ timeout: 30_000 });
    await cancelar.click();

    // El Media nace PENDING en el PRESIGN: sin el DELETE quedaría una tarjeta
    // muerta en la grilla hasta el cron de la fase 6.
    await expect(page.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Título', { exact: true })).toBeVisible();
    await expect.poll(() => tarjetas.count(), { timeout: 20_000 }).toBe(antes);
  });
});
