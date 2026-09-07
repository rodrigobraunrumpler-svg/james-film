import { expect, test } from '@playwright/test';
import { esperarAnimaciones } from './apoyo';

test.describe('el selector de tema', () => {
  test('cambia el tema y lo recuerda entre páginas', async ({ page }) => {
    await page.goto('/');
    // El defecto es OSCURO aunque el sistema pida claro: es la marca.
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'oscuro');

    await page.locator('[data-tema-boton]').locator('visible=true').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');

    // Sin esto, elegir claro y navegar devolvería al oscuro y parecería un fallo.
    await page.goto('/trabajos');
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  });

  test('actualiza el color de la barra del navegador', async ({ page }) => {
    // Sin esto la franja de arriba del iPhone se queda del tema anterior.
    await page.goto('/');
    const antes = await page.locator('meta[name="theme-color"]').getAttribute('content');
    await page.locator('[data-tema-boton]').locator('visible=true').first().click();
    const despues = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(despues).not.toBe(antes);
  });

  test('existe en móvil y en escritorio, y llega a los 48 px', async ({ page }) => {
    const boton = page.locator('[data-tema-boton]').locator('visible=true').first();
    await page.goto('/');
    const caja = await boton.boundingBox();
    expect(caja!.height).toBeGreaterThanOrEqual(47.5);
    expect(caja!.width).toBeGreaterThanOrEqual(44);
  });
});

test.describe('el menú marca dónde estás', () => {
  test('al bajar a paquetes, su entrada queda activa', async ({ page }) => {
    await page.goto('/');
    await esperarAnimaciones(page);

    // Nada activo arriba del todo: el hero no es una entrada del menú.
    expect(await page.locator('[data-nav][data-activo]').count()).toBe(0);

    await page.locator('#paquetes').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const activos = page.locator('[data-nav][data-activo]');
    expect(await activos.count()).toBeGreaterThan(0);
    for (const a of await activos.all()) {
      expect(await a.getAttribute('data-nav')).toContain('#paquetes');
    }
  });

  test('solo UNA entrada está activa a la vez', async ({ page }) => {
    await page.goto('/');
    // `#sobre-mi` y no `#calendario`: el calendario se mudó a su página, así
    // que en la portada ya no hay ancla que marcar.
    await page.locator('#sobre-mi').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const anclas = new Set(
      await page.locator('[data-nav][data-activo]').evaluateAll((els) =>
        els.map((e) => (e as HTMLElement).dataset.nav ?? ''),
      ),
    );
    expect(anclas.size).toBeLessThanOrEqual(1);
  });
});

test.describe('la escasez es honesta', () => {
  test('si se dice, dice un número y enlaza al calendario', async ({ page }) => {
    await page.goto('/');
    // Apunta a la PÁGINA, no al ancla: el calendario se mudó.
    const enlace = page.locator('a[href="/fechas-libres"]', { hasText: /sábado/ }).first();
    if ((await enlace.count()) === 0) {
      // Sin ningún sábado ocupado NO se pinta, y eso es lo correcto: «quedan 4
      // sábados libres» da la urgencia contraria.
      test.skip(true, 'no hay escasez que anunciar con estos datos');
    }
    await expect(enlace).toContainText(/quedan \d+ sábado/);
  });
});

test.describe('el menú de móvil', () => {
  test('enseña TODAS las entradas sin deslizar', async ({ page }) => {
    /**
     * Antes eran píldoras deslizables y **solo se veían dos**: el resto
     * —incluidas las páginas propias— quedaba detrás de un gesto que nada
     * anuncia. Eso es menos descubrible que un botón, no más.
     *
     * No se cuentan CINCO a pelo: cuántas entradas hay depende de los datos —el
     * menú esconde «Trabajos» sin galerías publicadas y «Testimonios» sin
     * ninguno con permiso, porque un enlace al vacío se nota más que no
     * tenerlo—. Un número fijo aquí ponía el test en rojo cada vez que James
     * despublicaba algo. Lo que hay que garantizar es el INVARIANTE: todas las
     * que se pintan se ven de una vez, sin scroll y sin desvanecer.
     */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const boton = page.locator('[data-abrir-menu]');
    await expect(boton).toBeVisible();
    await boton.click();

    const dialogo = page.locator('#menu-movil');
    await expect(dialogo).toBeVisible();

    const entradas = dialogo.locator('a[data-nav]');
    const cuantas = await entradas.count();
    // Las cuatro páginas propias están siempre; las de ancla dependen del dato.
    expect(cuantas, 'el menú se quedó sin entradas').toBeGreaterThanOrEqual(4);

    const mal = await entradas.evaluateAll((els) =>
      els
        .filter((e) => {
          const c = e.getBoundingClientRect();
          const fuera = c.top < 0 || c.bottom > window.innerHeight;
          // Legible YA: sin `entra`, que depende del observador y dentro de un
          // diálogo cerrado no dispara hasta abrirlo.
          const desvanecida = Number(getComputedStyle(e).opacity) <= 0.95;
          return fuera || desvanecida;
        })
        .map((e) => e.textContent?.trim() ?? ''),
    );
    expect(mal, `no se ven de una vez: ${mal.join(', ')}`).toEqual([]);
  });

  test('se maneja con teclado: foco atrapado y Escape cierra', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('[data-abrir-menu]').click();

    // `showModal()` y no el atributo `open`: con `open` el tabulador se pasea
    // por la página de detrás.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() =>
        document.getElementById('menu-movil')!.contains(document.activeElement),
      ),
      'el foco se escapó: ¿se abrió con `open` en vez de showModal()?',
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-movil')).toBeHidden();
  });

  test('un ancla de la misma página cierra el menú al pulsarla', async ({ page }) => {
    // Sin esto el diálogo se queda abierto tapando justo la sección a la que
    // acabas de ir: el enlace no navega, así que nada lo cierra.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('[data-abrir-menu]').click();
    await page.locator('#menu-movil a[data-nav="#paquetes"]').click();

    await expect(page.locator('#menu-movil')).toBeHidden();

    /**
     * Se espera a que el scroll PARE. `scroll-behavior: smooth` anima los cinco
     * mil píxeles hasta los paquetes y tarda unos 700 ms: medir justo después
     * de cerrar el diálogo daba cero y parecía que el enlace no hacía nada.
     */
    await expect
      .poll(async () => page.evaluate(() => Math.round(window.scrollY)), { timeout: 4000 })
      .toBeGreaterThan(100);

    // Y para en el sitio: `scroll-padding-top` deja el titular bajo la barra.
    const hueco = await page.evaluate(() => {
      const s = document.getElementById('paquetes')!.getBoundingClientRect().top;
      return Math.round(s);
    });
    expect(hueco, 'la sección queda debajo de la cabecera pegada').toBeGreaterThan(60);
  });
});
