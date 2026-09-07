import { expect, test, type Page } from '@playwright/test';
import { conTema, esperarAnimaciones, recorrerEntera, RUTAS, TEMAS } from './apoyo';

/**
 * La matriz de §7, medida. **320 px sin scroll horizontal** es donde se rompe
 * primero, y el zoom al 200 % es donde nadie mira.
 */
const ANCHOS = [320, 360, 390, 414, 768, 834, 1024, 1280, 1440] as const;

/** Nombra el elemento que desborda. Sin eso el fallo dice «desborda» y toca ir componente por componente. */
async function desbordes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limite = document.documentElement.clientWidth;
    const malos: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const est = getComputedStyle(el);
      if (est.display === 'none' || est.visibility === 'hidden') continue;

      /**
       * Lo que un ancestro RECORTA no desborda la página: no puede, el
       * recortador se lo come. Es el caso del aura del hero —un círculo de
       * 720 px dentro de su `overflow-hidden`— y de la tira de reels, que se
       * desliza a propósito. Sin esta comprobación el test acusaba a las dos
       * mientras el scroll real de la página estaba en cero, que es la señal
       * de que el que se equivocaba era el test.
       */
      let recortado = false;
      for (let n: Element | null = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const e = getComputedStyle(n);
        if (e.overflowX !== 'visible' || e.overflowY !== 'visible') {
          recortado = true;
          break;
        }
      }
      if (recortado) continue;

      const c = el.getBoundingClientRect();
      if (c.width === 0) continue;
      if (c.right > limite + 1 || c.left < -1) {
        malos.push(
          `${el.tagName.toLowerCase()}.${el.className.toString().split(' ').slice(0, 4).join('.')} ` +
            `→ ${Math.round(c.left)}..${Math.round(c.right)} (cabe 0..${limite})`,
        );
      }
    }
    return [...new Set(malos)].slice(0, 8);
  });
}

test.describe('responsive', () => {
  for (const ancho of ANCHOS) {
    test(`${ancho}px · sin scroll horizontal y nada se sale`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      for (const ruta of RUTAS) {
        await page.goto(ruta);
        await recorrerEntera(page);

        const scroll = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(scroll, `${ruta} a ${ancho}px mete ${scroll}px de scroll horizontal`).toBeLessThanOrEqual(1);

        const fuera = await desbordes(page);
        expect(fuera, `${ruta} a ${ancho}px:\n  ${fuera.join('\n  ')}`).toEqual([]);
      }
    });
  }

  test('zoom al 200 % no cambia las media queries y aun así cabe', async ({ page }) => {
    // El sitio real pasa a ser de 384 px mientras `lg:` sigue casando a 768.
    // Ahí es donde una cabecera con `flex-none` se sale, como pasó en el admin.
    await page.setViewportSize({ width: 768, height: 900 });
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await page.evaluate(() => {
        document.documentElement.style.zoom = '2';
      });
      await recorrerEntera(page);
      const scroll = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(scroll, `${ruta} al 200 % mete ${scroll}px de scroll horizontal`).toBeLessThanOrEqual(1);
    }
  });

  test('móvil horizontal: el hero no se come la pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await esperarAnimaciones(page);
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(scroll).toBeLessThanOrEqual(1);
    // El CTA tiene que estar a la vista sin bajar: en horizontal hay 390 px de
    // alto y un hero de 640 dejaría el botón fuera de la primera pantalla.
    const cta = page.locator('main [data-wa]').first();
    await expect(cta).toBeVisible();
  });
});

/**
 * El menú de escritorio, palabra por palabra.
 *
 * Va aparte de «nada se sale» porque este fallo NO desborda: cada entrada es un
 * `h-12` de alto fijo, así que el ancla se queda en 48px mientras el
 * `overflow-wrap: anywhere` del `body` **parte la palabra dentro**. Con seis
 * entradas y el número de teléfono, a 1280 salía «Trabaj / os» y «Testimoni /
 * os» sin que el `scrollWidth` se moviera un píxel — invisible para cualquier
 * test de desbordes, y evidente en una captura.
 */
test.describe('el menú de escritorio cabe', () => {
  for (const w of [1024, 1280, 1366, 1440, 1536, 1920]) {
    test(`a ${w}px no parte ninguna palabra ni saca el botón verde`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/');
      // Con la fuente sin cargar el texto mide menos y el fallo no aparece.
      await page.evaluate(() => document.fonts.ready);

      const mal = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Principal"]');
        if (!nav) return { partidas: [] as string[], seSale: false };
        const rango = document.createRange();
        const partidas: string[] = [];
        for (const a of nav.querySelectorAll(':scope > a')) {
          const texto = [...a.childNodes].find(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
          );
          if (!texto) continue;
          rango.selectNodeContents(texto);
          // Más de un rectángulo = el texto ocupa más de una línea.
          if (rango.getClientRects().length > 1) partidas.push(a.textContent?.trim() ?? '');
        }
        const wa = nav.querySelector('a[data-wa]')?.getBoundingClientRect();
        return {
          partidas,
          seSale: wa ? Math.round(wa.right) > document.documentElement.clientWidth : false,
        };
      });

      expect(mal.partidas, `se parten en dos líneas: ${mal.partidas.join(', ')}`).toEqual([]);
      expect(mal.seSale, 'el botón de WhatsApp se sale de la pantalla').toBe(false);
    });
  }
});

test.describe('objetivos táctiles', () => {
  for (const tema of TEMAS) {
    test(`48 px en todo lo pulsable · tema ${tema}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await conTema(page, tema);
      for (const ruta of RUTAS) {
        await page.goto(ruta);
        await recorrerEntera(page);
        // Con la animación en curso, un botón de 48 bajo `scale(0.97)` mide
        // 46,6 y el test falla por algo que no es un fallo.
        await esperarAnimaciones(page);

        const chicos = await page.evaluate(() => {
          const malos: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')) {
            const est = getComputedStyle(el);
            if (est.display === 'none' || est.visibility === 'hidden') continue;
            const c = el.getBoundingClientRect();
            if (c.width === 0 || c.height === 0) continue;
            // Un enlace DENTRO de un párrafo es texto, no un objetivo táctil:
            // exigirle 48 px de alto obligaría a maquetar la prosa como una
            // lista de botones.
            if (el.closest('p')) continue;
            // El enlace de salto mide 1×1 A PROPÓSITO hasta que recibe el
            // foco, que es cuando se puede pulsar. Se mide enfocado, en el
            // test de teclado.
            if (el.className.toString().includes('sr-only')) continue;
            if (c.height < 47.5 || c.width < 44) {
              malos.push(
                `«${(el.textContent ?? '').trim().slice(0, 24)}» ${Math.round(c.width)}×${Math.round(c.height)} · ` +
                  `${el.className.toString().split(' ').slice(0, 3).join('.')}`,
              );
            }
          }
          return [...new Set(malos)];
        });
        expect(chicos, `Objetivos por debajo de 48 px en ${ruta} (${tema}):\n  ${chicos.join('\n  ')}`).toEqual([]);
      }
    });
  }
});
