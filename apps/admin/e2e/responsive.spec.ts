import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirGaleriaConMedios, abrirPrimeraGaleria, irAlPanel } from './apoyo';

/**
 * Botones que NO son UI nuestra: los inyectan Next y TanStack Query en
 * desarrollo, miden 32 y 40 px, y sin filtrarlos el test pasa o falla según lo
 * que tengas abierto — que es peor que no tener test.
 */
const esDeDesarrollo = (boton: Locator): Promise<boolean> =>
  boton.evaluate((el) => {
    // Se sube CRUZANDO shadow roots: Playwright los atraviesa al buscar por rol,
    // pero `closest()` se para en el límite, así que el botón de dev tools de
    // Next —que vive dentro de uno— se colaba y hacía fallar la medida con 32px.
    let n: Element | null = el;
    while (n) {
      if (n.tagName === 'NEXTJS-PORTAL' || n.classList?.contains('tsqd-open-btn')) return true;
      n = n.parentElement ?? (n.getRootNode() as ShadowRoot).host ?? null;
    }
    return false;
  });

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
        if (await esDeDesarrollo(boton)) continue;
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
    await expect(page.getByLabel('Título', { exact: true })).toBeVisible();
  });

  test('un título de 60 caracteres no rompe la tarjeta de la lista', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await irAlPanel(page);
    await abrirPrimeraGaleria(page);

    await page.getByLabel('Título', { exact: true }).fill('X'.repeat(60));
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
      if (await esDeDesarrollo(boton)) continue;
      const caja = await boton.boundingBox();
      // §7: es el pulgar de James en una pantalla pequeña, no una preferencia.
      expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * El editor y su visor, medidos en los cuatro anchos que importan. Se mide el
 * DOM —`scrollWidth` contra `clientWidth`— y no se mira una captura: un
 * desbordamiento de tres píxeles no se ve y rompe igual.
 */
const ANCHOS = [
  { nombre: '320 (el más estrecho de §7)', width: 320, height: 640 },
  { nombre: '390 (iPhone de James)', width: 390, height: 844 },
  { nombre: '768 (tablet vertical)', width: 768, height: 1024 },
  { nombre: '1440 (escritorio)', width: 1440, height: 900 },
];

test.describe('el editor y el visor en todos los anchos', () => {
  for (const { nombre, width, height } of ANCHOS) {
    test(`a ${nombre} no desborda, ni con el visor abierto`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await irAlPanel(page);
      // `count()` NO espera: llamarlo justo después de abrir devuelve 0 y el
      // test se salta solo, que es la peor forma de pasar.
      expect(await abrirGaleriaConMedios(page), 'ninguna galería tiene medios').toBe(true);
      expect(await desbordaHorizontal(page), `el editor desborda a ${width}px`).toBe(false);

      await page.getByRole('button', { name: /^Ver / }).first().click();
      const visor = page.getByRole('dialog');
      await expect(visor).toBeVisible();
      expect(await desbordaHorizontal(page), `el visor desborda a ${width}px`).toBe(false);

      // El archivo tiene que CABER: `contain` no sirve de nada si la caja se
      // sale por abajo y hay que scrollear para ver el pie de la foto.
      const caja = await visor.boundingBox();
      expect(caja?.width ?? 0).toBeLessThanOrEqual(width + 1);
      expect(caja?.height ?? 0).toBeLessThanOrEqual(height + 1);

      // Y se cierra con Escape, que es lo que hace todo el mundo.
      await page.keyboard.press('Escape');
      await expect(visor).toBeHidden();
    });
  }

  test('nada dentro de una tesela se sale de su celda', async ({ page }) => {
    // El test de arriba mide el DOCUMENTO. Esto mide la CELDA: los botones de
    // acción se salían hacia la de al lado y el documento no crecía, así que
    // pasaba en verde con la pantalla rota.
    await page.setViewportSize({ width: 390, height: 844 });
    await irAlPanel(page);
    expect(await abrirGaleriaConMedios(page)).toBe(true);

    const desbordes = await page.evaluate(() =>
      [...document.querySelectorAll('li')]
        .filter((li) => li.querySelector('[aria-label^="Ver "]'))
        .map((li, i) => ({ i, dx: li.scrollWidth - li.clientWidth }))
        .filter((r) => r.dx > 1),
    );
    expect(desbordes, 'teselas cuyo contenido se sale').toEqual([]);
  });

  test('la cabecera del editor no aplasta el título en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await irAlPanel(page);
    await abrirPrimeraGaleria(page);

    // Con las acciones sin encoger, al título le quedaban 90px y las migas se
    // partían en dos líneas.
    const ancho = await page
      .getByLabel('Título', { exact: true })
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(ancho, 'el campo del título se queda sin sitio').toBeGreaterThan(240);
  });

  test('dentro de una galería, el menú sigue marcando «Galerías»', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await irAlPanel(page);
    await abrirPrimeraGaleria(page);

    // Acotado al MENÚ: las migas tienen otro enlace «Galerías» que va al mismo
    // sitio, y sin acotar son dos coincidencias.
    const menu = page.getByRole('navigation', { name: 'Principal' });
    // `aria-current="page"` es lo que anuncia un lector de pantalla y lo que
    // pinta el fondo: si no está, no hay forma de saber dónde estás.
    await expect(menu.getByRole('link', { name: 'Galerías' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('en el visor, los controles llegan a 44 px en táctil', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await irAlPanel(page);
    expect(await abrirGaleriaConMedios(page)).toBe(true);
    await page.getByRole('button', { name: /^Ver / }).first().click();

    const visor = page.getByRole('dialog');
    await expect(visor).toBeVisible();
    // El visor entra con `scale(0.97)`: midiendo a mitad de la animación un
    // botón de 44px da 43,65 y el test falla por algo que no es un fallo.
    // `getAnimations` espera a que termine de verdad, sin un `waitForTimeout`
    // a ojo que se quedaría corto en una máquina lenta.
    await visor.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
    for (const boton of await visor.getByRole('button').all()) {
      if (!(await boton.isVisible())) continue;
      const caja = await boton.boundingBox();
      expect(caja?.height ?? 0, 'control del visor bajo de 44px').toBeGreaterThanOrEqual(44);
    }
  });

  test('pulsar la miniatura ABRE el visor de verdad, no solo en el DOM', async ({ page }) => {
    // Testing Library pulsa el nodo directamente y no sabe si algo lo tapa.
    // Playwright sí hace hit-testing: este test es el que detecta una capa
    // invisible por encima, que es justo lo que pasó con el overlay de acciones.
    await page.setViewportSize({ width: 1440, height: 900 });
    await irAlPanel(page);
    expect(await abrirGaleriaConMedios(page)).toBe(true);

    // `click()` de Playwright hace hit-testing: si algo tapa la miniatura, falla.
    // Testing Library pulsa el nodo directamente y no se entera — que es
    // exactamente cómo la capa de acciones se tragó el clic sin que ningún test
    // unitario se quejara.
    await page.getByRole('button', { name: /^Ver / }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
