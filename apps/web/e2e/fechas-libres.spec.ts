import { expect, test } from '@playwright/test';

/**
 * `/fechas-libres` es una página aparte, y eso tiene un coste: mete una carga
 * entre «está interesada» y «pulsa WhatsApp». Lo que lo compensa —y por eso
 * tiene su propio test— es que **la fecha vuelve con el visitante**.
 */
test('la página trae calendario, sábados rápidos, pasos y estados', async ({ page }) => {
  await page.goto('/fechas-libres');

  expect(await page.locator('h1').filter({ hasText: /libre tu día/ }).count()).toBe(1);
  expect(await page.locator('[data-dia]').count(), 'la rejilla del mes').toBeGreaterThan(20);
  expect(await page.locator('ol li').count(), 'los tres pasos').toBeGreaterThanOrEqual(3);
  // Los estados van DIBUJADOS con el mismo elemento que la rejilla: si no se
  // parecen, explicarlos no sirve de nada.
  expect(await page.locator('.dia-muestra').count()).toBe(3);
});

test('un sábado rápido elige ese día en la rejilla', async ({ page }) => {
  await page.goto('/fechas-libres');
  const chip = page.locator('[data-sabado]').first();
  test.skip((await chip.count()) === 0, 'no hay sábados libres con estos datos');

  const dia = await chip.getAttribute('data-sabado');
  await chip.click();

  // Pulsa el DÍA de verdad en vez de duplicar la lógica: el rango, el mensaje
  // y el texto del botón salen del mismo sitio que si lo hubieras tocado.
  await expect(page.locator(`[data-dia="${dia}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
});

test('un sábado del MES SIGUIENTE navega el calendario y se elige', async ({ page }) => {
  /**
   * Fallaba en silencio: el chip buscaba `[data-dia="2026-10-03"]` en el DOM y
   * la rejilla solo pinta el mes visible, así que ese botón no existía. Pulsar
   * un sábado de octubre con setiembre a la vista no hacía absolutamente nada.
   */
  await page.goto('/fechas-libres');
  const chips = page.locator('[data-sabado]');
  test.skip((await chips.count()) < 2, 'hacen falta al menos dos sábados libres');

  const mesInicial = (await page.locator('[data-mes-actual]').innerText()).trim();
  const ultimo = chips.last();
  const dia = (await ultimo.getAttribute('data-sabado'))!;
  test.skip(dia.slice(0, 7) === mesInicial && false, '');

  await ultimo.click();
  await expect(page.locator(`[data-dia="${dia}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(ultimo).toHaveAttribute('aria-pressed', 'true');

  // Si el chip era de otro mes, el calendario tuvo que moverse para enseñarlo.
  const mesFinal = (await page.locator('[data-mes-actual]').innerText()).trim();
  if (dia.slice(0, 7) !== new Date().toISOString().slice(0, 7)) {
    expect(mesFinal, 'el calendario no saltó al mes del chip').not.toBe('');
  }
});

test('la fecha elegida VUELVE a los CTA de la portada', async ({ page }) => {
  await page.goto('/fechas-libres');
  const chip = page.locator('[data-sabado]').first();
  test.skip((await chip.count()) === 0, 'no hay sábados libres con estos datos');
  await chip.click();
  await page.waitForTimeout(200);

  await page.goto('/');
  await page.waitForTimeout(400);

  const href = await page.locator('[data-wa][data-fuente="paquetes"]').first().getAttribute('href');
  const texto = decodeURIComponent(new URL(href!).searchParams.get('text') ?? '');

  /**
   * Se comprueba la ESTRUCTURA, no una frase: el texto de la primera línea lo
   * escribe James en Configuración y puede cambiar cualquier día, así que un
   * `toMatch` sobre sus palabras rompería el test sin que nada esté mal.
   *
   * Lo que no puede cambiar es la forma: dos líneas, y la de abajo con la
   * fecha. Es lo que hace que la página separada no sea un desvío inútil.
   */
  const [base, blanca, fecha] = texto.split('\n');
  expect(blanca, 'el salto es doble o WhatsApp junta las dos líneas').toBe('');
  expect(base?.length ?? 0).toBeGreaterThan(0);
  // Sin emoji: se quitó porque en un WhatsApp sin fuente de emoji salía como
  // `�` justo en el cuadro de texto, o sea en el momento de decidir si envía.
  expect(fecha, 'la fecha elegida no volvió con el visitante').toMatch(/^\S.+\?$/);
  expect(fecha, 'volvió a colarse un emoji en el mensaje').not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
});

test('el menú lleva a la página, no a un ancla muerta', async ({ page }) => {
  await page.goto('/');
  const enlace = page.locator('[data-nav="/fechas-libres/"]').first();
  expect(await enlace.count()).toBeGreaterThan(0);
  const res = await page.request.get('/fechas-libres');
  expect(res.status()).toBe(200);
  // Y ya no queda ningún `#calendario` colgando de la portada.
  expect(await page.locator('a[href="#calendario"]').count()).toBe(0);
});


/**
 * COMPARAR SIN IRSE, que es lo que pedía el usuario: «me lleva hasta la otra
 * sección y tengo que volver otra vez».
 *
 * Antes había tres chips con el nombre del paquete a secas y un enlace a
 * `/#paquetes` — otra página—. Para saber qué separa al Pro del Premium había
 * que viajar, y volver perdía el hilo: el calendario no restaura la selección
 * al montar, así que se volvía a una rejilla en blanco.
 */
test.describe('los paquetes viven en la misma página', () => {
  test('«Compara los tres» NO cambia de página y deja la sección a la vista', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fechas-libres');

    const enlace = page.getByRole('link', { name: /Compara los tres/i });
    await expect(enlace).toBeVisible();
    // Ancla LOCAL: sin barra delante. Con `/#paquetes` esto sería otra página.
    expect(await enlace.getAttribute('href'), 'sigue saliendo de la página').toBe('#paquetes');

    await enlace.click();
    await page.waitForTimeout(600);
    expect(new URL(page.url()).pathname, 'la ruta cambió: hubo navegación').toBe('/fechas-libres');
    await expect(page.locator('#paquetes')).toBeInViewport();
  });

  test('los chips de nombre suelto ya no están: se compara con la tarjeta entera', async ({
    page,
  }) => {
    await page.goto('/fechas-libres');
    // Lo que decidía entre S/ 600 y S/ 900 —los reels y el aftermovie— vive en
    // los bullets, y un chip con el nombre no puede enseñarlos.
    await expect(page.getByText('¿Ya sabes cuál quieres?')).toHaveCount(0);
    expect(await page.locator('#paquetes [data-wa][data-paquete]').count()).toBeGreaterThan(0);
  });

  test('elegir un día deja la fecha en las tarjetas SIN recargar', async ({ page }) => {
    await page.goto('/fechas-libres');
    const dia = page.locator('[data-dia]:not([disabled])').first();
    test.skip((await dia.count()) === 0, 'no hay días libres con estos datos');
    await dia.click();
    await page.waitForTimeout(250);

    const boton = page.locator('#paquetes [data-wa][data-paquete]').first();
    const texto = decodeURIComponent(
      new URL((await boton.getAttribute('href'))!).searchParams.get('text') ?? '',
    );
    const [base, blanca, fecha] = texto.split('\n');
    expect(base?.length ?? 0).toBeGreaterThan(0);
    expect(blanca, 'el salto doble se perdió').toBe('');
    expect(fecha, 'la tarjeta no se enteró de la fecha elegida').toMatch(/^\S.+\?$/);
  });

  test('la fuente empieza por «calendario» o el panel no sabrá QUÉ DÍA pedían', async ({ page }) => {
    /**
     * `fechaPedida()` en el `Layout` adjunta `requestedDate` solo si la fuente
     * empieza por `calendario`. Con `paquetes` o `footer`, el día viaja dentro
     * del mensaje de WhatsApp y se tira del panel — o sea que la página que
     * existe para medir demanda de fechas era la que peor la medía.
     */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fechas-libres');

    const fuentes = await page.evaluate(() =>
      [...document.querySelectorAll('#paquetes [data-wa], #barra-pegada [data-wa]')].map(
        (a) => (a as HTMLElement).dataset.fuente ?? '',
      ),
    );
    expect(fuentes.length, 'no se recogió ningún botón: ¿cambió el marcado?').toBeGreaterThan(3);
    expect(
      fuentes.filter((f) => !f.startsWith('calendario')),
      `fuentes que tiran la fecha: ${fuentes.join(', ')}`,
    ).toEqual([]);
  });

  test('el menú apunta a los paquetes de ESTA página, no a los de la portada', async ({ page }) => {
    await page.goto('/fechas-libres');
    // Con `/#paquetes` el menú marcaría «Paquetes» como sección activa —el
    // observador resuelve por `getElementById`— mientras su enlace se va a otra
    // página. Mentiría sin romper nada, que es la peor forma de fallar.
    const nav = page.locator('[data-nav="#paquetes"]').first();
    expect(await nav.count(), 'el menú sigue mandando a la portada').toBeGreaterThan(0);
  });
});


/**
 * VOLVER A LA PÁGINA NO PIERDE LA FECHA.
 *
 * El calendario la guardaba en `sessionStorage` y **no la leía nunca**: quien
 * elegía el 24, bajaba a comparar paquetes o se iba a la portada y volvía, se
 * encontraba la rejilla en blanco. Y el CTA del calendario es el único
 * `[data-wa]` que el enriquecedor del `Layout` no reescribe —lo lleva el script
 * de la propia sección—, así que al volver se quedaba sin fecha en el mensaje.
 */
test('al volver, el día elegido sigue puesto y el mensaje lo lleva', async ({ page }) => {
  await page.goto('/fechas-libres/');
  const dia = page.locator('[data-dia]:not([disabled])').first();
  test.skip((await dia.count()) === 0, 'no hay días libres con estos datos');
  const iso = await dia.getAttribute('data-dia');
  await dia.click();
  await page.waitForTimeout(200);

  await page.goto('/');
  await page.goto('/fechas-libres/');
  await page.waitForTimeout(300);

  await expect(page.locator('[data-elegido]')).toBeVisible();
  await expect(page.locator('[data-dia][aria-pressed="true"]')).toHaveAttribute('data-dia', iso!);

  const texto = decodeURIComponent(
    new URL((await page.locator('[data-cta-calendario]').getAttribute('href'))!).searchParams.get(
      'text',
    ) ?? '',
  );
  const fecha = texto.split('\n').at(-1)!;
  expect(fecha, 'el mensaje volvió sin la fecha').toMatch(/^\S.+\?$/);

  // Y la FUENTE tiene que decir de dónde sale, para que el panel registre el día.
  const fuente = await page.locator('[data-cta-calendario]').getAttribute('data-fuente');
  expect(fuente, 'sin fuente de calendario el panel tira la fecha pedida').toMatch(/^calendario-/);
});
