import { expect, test } from '@playwright/test';

/**
 * NINGÚN ENLACE INTERNO PUEDE LLEVAR A UN 404.
 *
 * Este test existe por un fallo que estuvo publicado y que no se veía desde el
 * código: las cinco tarjetas de categoría de la portada enlazaban a `/bodas`,
 * `/xv-anos`… y **esas páginas no se generaban**. Cada una era un 404, y el
 * `astro check`, el build y los otros 56 tests pasaban tan contentos.
 *
 * Se compara lo que el build EMITE con lo que el build GENERA, que es la única
 * forma de verlo.
 */
const SEMILLAS = ['/', '/trabajos', '/fechas-libres', '/privacidad', '/terminos', '/uso-de-imagen'];

test('ningún enlace interno da 404', async ({ page, request }) => {
  const vistos = new Set<string>();
  const rotos: string[] = [];

  for (const semilla of SEMILLAS) {
    await page.goto(semilla);
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href')!)
        // Solo lo interno: `wa.me` y las redes son de otro.
        .filter((h) => h.startsWith('/') && !h.startsWith('//')),
    );

    for (const href of hrefs) {
      const ruta = href.split('#')[0]!;
      if (!ruta || vistos.has(ruta)) continue;
      vistos.add(ruta);
      const res = await request.get(ruta);
      if (res.status() >= 400) rotos.push(`${ruta} → ${res.status()} (enlazado desde ${semilla})`);
    }
  }

  expect(vistos.size, 'no se recogió ningún enlace: ¿cambió el marcado?').toBeGreaterThan(5);
  expect(rotos, `Enlaces rotos:\n  ${rotos.join('\n  ')}`).toEqual([]);
});

test('la 404 propia existe y ofrece salida', async ({ page }) => {
  // `astro preview` sirve la 404 del build; en Pages hace lo mismo.
  const res = await page.goto('/esto-no-existe-de-ninguna-manera');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toBeVisible();
  // Lo importante: que siga habiendo un camino a WhatsApp y a los trabajos.
  // `visible=true` y no `.first()`: la barra lleva dos CTA, uno de móvil y
  // otro de escritorio, y el primero del DOM está oculto en el otro ancho.
  await expect(page.locator('[data-wa]').locator('visible=true').first()).toBeVisible();
  await expect(page.locator('a[href="/trabajos/"]').locator('visible=true').first()).toBeVisible();
});

test('las cuatro páginas propias existen y el menú lleva a las tres', async ({ page, request }) => {
  /**
   * Las secciones que se mudaron a página son las que el menú promete. Un menú
   * que apunta a un ancla que ya no existe no lleva a ninguna parte, y eso no
   * lo caza nada que mire el código.
   */
  for (const ruta of ['/fechas-libres', '/negocios', '/sobre-mi', '/trabajos']) {
    const res = await request.get(ruta);
    expect(res.status(), `${ruta} no responde`).toBe(200);
  }

  await page.goto('/');
  // Con la barra final: es la forma CANÓNICA —la que emiten el `canonical` y el
  // sitemap— y usarla en el menú evita una redirección 301 por cada clic.
  for (const ruta of ['/fechas-libres/', '/negocios/', '/sobre-mi/']) {
    expect(await page.locator(`[data-nav="${ruta}"]`).count(), `falta en el menú: ${ruta}`)
      .toBeGreaterThan(0);
  }
});

test('lo que se promete a TODOS es lo que cumplen los tres paquetes', async ({ page }) => {
  /**
   * El flyer da **4 · 6 · 7** reels y **48h** de entrega salvo en el Premium.
   * La web publicaba «7 reels» en la tira de «en los tres, siempre» y en «qué
   * recibes», y «24 horas» en el hero, el bento, los pasos y la tira de
   * confianza. Quien contratara el Básico esperando siete reels en un día iba
   * a recibir cuatro en dos.
   *
   * Se miran solo las promesas COMPARTIDAS. En la tarjeta del Premium, «7
   * Reels» y «24h» son ciertos: ahí es contenido, no una promesa a todos.
   */
  await page.goto('/');

  const compartidas = await page.evaluate(() => {
    const trozos: string[] = [];
    // La tira de «en los tres, siempre», el hero, los pasos y qué recibes.
    /*
     * `#paquetes [data-en-los-tres]`, y NO `#paquetes > div:nth-of-type(1)`.
     *
     * `Seccion.astro` pinta un `<div>` como raíz, así que el primer hijo de
     * `#paquetes` es la CABECERA, no la tira. O sea que este test llevaba
     * verde sin haber leído nunca la tira que dice proteger: comprobado
     * ejecutando su propio `evaluate` contra el build, «En los tres, siempre»
     * NO aparecía en el texto recogido aunque sí estaba en la página.
     *
     * Se marca con un atributo y no con otra posición: `nth-of-type(2)` se
     * vuelve a romper en cuanto alguien inserte un div en medio.
     */
    for (const sel of ['main > section:first-of-type', '#paquetes [data-en-los-tres]']) {
      const el = document.querySelector(sel);
      if (el) trozos.push(el.textContent ?? '');
    }
    for (const h of document.querySelectorAll('h2')) {
      const t = h.textContent ?? '';
      if (/tres pasos|te llega al celular/i.test(t)) {
        trozos.push(h.closest('section')?.textContent ?? '');
      }
    }
    return trozos.join(' ').replace(/\s+/g, ' ');
  });

  expect(compartidas.length, 'no se recogió nada: ¿cambió el marcado?').toBeGreaterThan(200);
  // Y que la tira esté DENTRO de lo recogido: sin esto el test pasaba en vacío.
  expect(compartidas, 'no se recogió la tira de «En los tres, siempre»').toMatch(
    /En los tres, siempre/,
  );
  expect(compartidas, 'se promete «7 reels» a todos y el Básico da 4').not.toMatch(/7 reels/i);

  for (const m of [...compartidas.matchAll(/24\s?h(oras)?/gi)]) {
    const cerca = compartidas.slice(Math.max(0, m.index! - 100), m.index! + 100);
    expect(cerca, `«24 h» sin decir que es del Premium: …${cerca}…`).toMatch(/Premium/i);
  }
});


/**
 * Y LAS ANCLAS TAMBIÉN, que hasta ahora no se comprobaban.
 *
 * El test de arriba hace `href.split('#')[0]`, así que `/#trabajos` se
 * comprobaba como `/` y daba 200 aunque esa sección no se pintara. Es
 * exactamente el fallo que tenían nueve páginas: llevaban `#trabajos` escrito a
 * mano en el menú y, sin galerías publicadas, tocarlo dejaba al visitante
 * arriba de la portada sin haberse movido a ningún sitio.
 *
 * Un ancla a otra página se comprueba EN esa página; una local, en la propia.
 */
test('ningún ancla lleva a un sitio que no existe', async ({ page }) => {
  const rotas: string[] = [];
  const porPagina = new Map<string, Set<string>>();

  for (const semilla of [...SEMILLAS, '/negocios', '/sobre-mi', '/testimonios']) {
    await page.goto(semilla);
    const anclas = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href')!)
        .filter((h) => h.includes('#') && !h.startsWith('http')),
    );
    for (const href of anclas) {
      const [ruta, id] = href.split('#');
      if (!id) continue;
      // Una ruta vacía es la página actual.
      const destino = ruta === '' ? semilla : ruta!;
      if (!porPagina.has(destino)) porPagina.set(destino, new Set());
      porPagina.get(destino)!.add(`${id}|${semilla}`);
    }
  }

  for (const [destino, ids] of porPagina) {
    await page.goto(destino);
    for (const entrada of ids) {
      const [id, desde] = entrada.split('|');
      if ((await page.locator(`#${id}`).count()) === 0) {
        rotas.push(`#${id} no existe en ${destino} (enlazado desde ${desde})`);
      }
    }
  }

  expect(porPagina.size, 'no se recogió ningún ancla: ¿cambió el marcado?').toBeGreaterThan(0);
  expect(rotas, `Anclas rotas:\n  ${rotas.join('\n  ')}`).toEqual([]);
});


/**
 * NINGÚN ENLACE INTERNO EN LA FORMA NO CANÓNICA.
 *
 * El build es `directory`, así que la URL buena de una página es `/negocios/` —
 * es la que emiten el `canonical` y el sitemap—. Con los enlaces sin la barra,
 * cada clic del menú era un 301 antes de pintar nada, en todas las páginas y
 * para todo el mundo. No lo caza el test de arriba: `/negocios` responde 200
 * porque el servidor redirige, y desde el test no se nota.
 */
test('los enlaces internos usan la forma canónica, sin redirección', async ({ page }) => {
  const malos: string[] = [];

  for (const semilla of SEMILLAS) {
    await page.goto(semilla);
    const sinBarra = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href')!)
        // Internos, sin ancla, y que no sean la raíz ni un fichero con extensión.
        .filter((h) => /^\/[a-z0-9-]+$/i.test(h)),
    );
    for (const h of new Set(sinBarra)) malos.push(`${h} (en ${semilla})`);
  }

  expect(malos, `Enlaces que provocan un 301:\n  ${malos.join('\n  ')}`).toEqual([]);
});
