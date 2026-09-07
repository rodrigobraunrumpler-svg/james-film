import { expect, test, type Locator, type Page } from '@playwright/test';
import { asegurarGaleriaConMedios, bajarDelTodo, esperarAnimaciones, irAlPanel } from './apoyo';

/**
 * La revisión responsive COMPLETA: todas las pantallas por todos los anchos que
 * importan, medida y no mirada a ojo.
 *
 * Es distinta de `responsive.spec.ts`, que comprueba casos concretos ya
 * conocidos (un título de 60 caracteres, el visor abierto, el editor). Esta
 * barre la matriz entera y falla nombrando el ancho, la pantalla y **el
 * elemento** que se sale, que es lo que hace falta para arreglarlo sin buscar.
 */

/** Del más estrecho de §7 al monitor grande, pasando por tablet en las dos orientaciones. */
const ANCHOS = [
  { w: 320, h: 640, nombre: '320 (el mínimo de §7)', tactil: true },
  { w: 360, h: 740, nombre: '360 (Android común)', tactil: true },
  { w: 390, h: 844, nombre: '390 (el iPhone de James)', tactil: true },
  { w: 430, h: 932, nombre: '430 (iPhone Max)', tactil: true },
  { w: 768, h: 1024, nombre: '768 (tablet vertical)', tactil: true },
  { w: 1024, h: 768, nombre: '1024 (tablet horizontal)', tactil: false },
  { w: 1280, h: 800, nombre: '1280 (portátil)', tactil: false },
  { w: 1440, h: 900, nombre: '1440 (escritorio)', tactil: false },
  { w: 1920, h: 1080, nombre: '1920 (monitor grande)', tactil: false },
] as const;

const PANTALLAS = [
  { ruta: '/', nombre: 'Galerías', ancla: 'Buscar galerías' },
  { ruta: '/panel', nombre: 'Panel', ancla: 'Clics a WhatsApp' },
  { ruta: '/categorias', nombre: 'Categorías', ancla: 'Menú de la web' },
  { ruta: '/paquetes', nombre: 'Paquetes', ancla: null },
  { ruta: '/testimonios', nombre: 'Testimonios', ancla: null },
  { ruta: '/disponibilidad', nombre: 'Disponibilidad', ancla: 'Lo que viene' },
  { ruta: '/configuracion?pestana=identidad', nombre: 'Ajustes · Identidad', ancla: null },
  { ruta: '/configuracion?pestana=contacto', nombre: 'Ajustes · Contacto', ancla: 'Vista previa de la web' },
  {
    ruta: '/configuracion?pestana=diferenciadores',
    nombre: 'Ajustes · Diferenciadores',
    ancla: 'Vista previa de los diferenciadores',
  },
  { ruta: '/configuracion?pestana=hero', nombre: 'Ajustes · Hero', ancla: 'Vista previa de la web' },
  { ruta: '/configuracion?pestana=seo', nombre: 'Ajustes · SEO', ancla: 'Vista previa del SEO' },
] as const;

/** El síntoma que §7 prohíbe, medido en el documento entero. */
const desbordaHorizontal = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

/**
 * QUÉ se sale, no solo que algo se sale. Sin esto el fallo dice «desborda» y
 * hay que ir elemento por elemento a mano.
 *
 * Se ignora lo que se sale a propósito: lo `fixed` de las devtools, lo que
 * tiene scroll propio —una tira de pestañas se desliza con el dedo— y lo que
 * está oculto.
 */
async function culpables(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limite = document.documentElement.clientWidth;
    const fuera: string[] = [];

    /**
     * Lo que inyectan Next y TanStack Query en desarrollo no es UI nuestra.
     * Se sube por ancestros: el `<g>` de dentro de un SVG del botón de
     * devtools es `static` y se colaba por el filtro de `fixed`.
     */
    const esDeDesarrollo = (el: Element): boolean => {
      let n: Element | null = el;
      while (n) {
        if (n.tagName === 'NEXTJS-PORTAL' || n.classList?.contains('tsqd-open-btn')) return true;
        if (getComputedStyle(n).position === 'fixed') return true;
        n = n.parentElement ?? ((n.getRootNode() as ShadowRoot).host ?? null);
      }
      return false;
    };

    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (esDeDesarrollo(el)) continue;
      const estilo = getComputedStyle(el);
      if (estilo.display === 'none' || estilo.visibility === 'hidden') continue;
      // Con scroll propio, salirse por dentro es su trabajo.
      if (estilo.overflowX === 'auto' || estilo.overflowX === 'scroll') continue;

      const caja = el.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) continue;
      if (caja.right <= limite + 1 && caja.left >= -1) continue;

      const padre = el.parentElement;
      if (padre) {
        const estiloPadre = getComputedStyle(padre);
        if (estiloPadre.overflowX === 'auto' || estiloPadre.overflowX === 'scroll') continue;
      }

      const clase = el.className?.toString().slice(0, 90) ?? '';
      fuera.push(
        `<${el.tagName.toLowerCase()} class="${clase}"> ` +
          `left=${Math.round(caja.left)} right=${Math.round(caja.right)} (límite ${limite})`,
      );
      if (fuera.length >= 4) break;
    }
    return fuera;
  });
}

/** Botones que NO son UI nuestra: los inyectan Next y TanStack Query. */
const esDeDesarrollo = (boton: Locator): Promise<boolean> =>
  boton.evaluate((el) => {
    let n: Element | null = el;
    while (n) {
      if (n.tagName === 'NEXTJS-PORTAL' || n.classList?.contains('tsqd-open-btn')) return true;
      n = n.parentElement ?? ((n.getRootNode() as ShadowRoot).host ?? null);
    }
    return false;
  });

/** Nada dentro de una tarjeta puede salirse de su propia caja. */
async function desbordanCeldas(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const malas: string[] = [];
    for (const celda of document.querySelectorAll<HTMLElement>(sel)) {
      const fuera = celda.getBoundingClientRect();
      if (fuera.width === 0) continue;
      for (const hijo of celda.querySelectorAll<HTMLElement>('*')) {
        const estilo = getComputedStyle(hijo);
        if (estilo.position === 'fixed' || estilo.position === 'absolute') continue;
        if (estilo.display === 'none') continue;
        const caja = hijo.getBoundingClientRect();
        if (caja.width === 0) continue;
        if (caja.right > fuera.right + 1 || caja.left < fuera.left - 1) {
          malas.push(`${hijo.tagName.toLowerCase()}.${hijo.className?.toString().slice(0, 50)}`);
          break;
        }
      }
    }
    return malas;
  }, selector);
}

test.describe('responsive de TODAS las pantallas', () => {
  for (const { w, h, nombre, tactil } of ANCHOS) {
    test(`a ${nombre}: ninguna pantalla desborda`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await irAlPanel(page);

      for (const { ruta, nombre: pantalla, ancla } of PANTALLAS) {
        await page.goto(ruta);
        // Se espera al CONTENIDO, no al titular: el `h1` se pinta con el
        // skeleton todavía puesto, y medir entonces mide el skeleton.
        if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
        else await page.getByRole('heading', { level: 1 }).waitFor();
        await esperarAnimaciones(page);

        const fuera = await culpables(page);
        expect(
          await desbordaHorizontal(page),
          `${pantalla} desborda a ${w}px. Se salen:\n${fuera.join('\n') || '(no se identificó el elemento)'}`,
        ).toBe(false);
      }
    });

    if (tactil) {
      test(`a ${nombre}: todo lo pulsable llega a 44 px`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await irAlPanel(page);

        for (const { ruta, nombre: pantalla, ancla } of PANTALLAS) {
          await page.goto(ruta);
          if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
          else await page.getByRole('heading', { level: 1 }).waitFor();
          await esperarAnimaciones(page);

          for (const control of await page.getByRole('button').all()) {
            if (!(await control.isVisible())) continue;
            if (await control.evaluate((el) => el.matches('input[type="file"]'))) continue;
            if (await esDeDesarrollo(control)) continue;
            const caja = await control.boundingBox();
            const texto = (await control.textContent())?.trim().slice(0, 30) ?? '';
            expect(
              caja?.height ?? 0,
              `«${texto || (await control.getAttribute('aria-label'))}» mide ${caja?.height}px en ${pantalla} a ${w}px`,
              // Medio píxel de holgura: un `min-h-11` en una `y` fraccionaria lo
              // devuelve el navegador como 43.99997. Ver `responsive.spec.ts`.
            ).toBeGreaterThanOrEqual(43.5);
          }
        }
      });
    }
  }
});

test.describe('nada se sale de su tarjeta', () => {
  for (const { w, h, nombre } of ANCHOS) {
    test(`a ${nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await irAlPanel(page);

      for (const [ruta, ancla, celda] of [
        ['/panel', 'Clics a WhatsApp', 'section[aria-label]'],
        ['/categorias', 'Menú de la web', 'article'],
        ['/paquetes', null, 'article'],
        ['/testimonios', null, 'article'],
      ] as const) {
        await page.goto(ruta);
        if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
        else await page.getByRole('heading', { level: 1 }).waitFor();
        await esperarAnimaciones(page);

        const malas = await desbordanCeldas(page, celda);
        expect(malas, `en ${ruta} a ${w}px se salen de su caja: ${malas.join(', ')}`).toEqual([]);
      }
    });
  }
});

test.describe('las capas que se abren tampoco desbordan', () => {
  for (const { w, h, nombre } of ANCHOS) {
    test(`a ${nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await irAlPanel(page);

      // El buscador ⌘K, desde cualquier pantalla.
      await page.goto('/panel');
      await page.getByLabel('Clics a WhatsApp').waitFor({ timeout: 15_000 });
      await page.keyboard.press('ControlOrMeta+k');
      await page.getByRole('textbox', { name: 'Buscar' }).fill('a');
      await esperarAnimaciones(page);
      expect(await desbordaHorizontal(page), `el buscador desborda a ${w}px`).toBe(false);
      await page.keyboard.press('Escape');

      // La hoja de nueva categoría.
      await page.goto('/categorias');
      await page.getByLabel('Menú de la web').waitFor({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Nueva categoría' }).click();
      await page.getByRole('dialog').waitFor();
      await esperarAnimaciones(page);
      expect(await desbordaHorizontal(page), `la hoja de categoría desborda a ${w}px`).toBe(false);
      await page.keyboard.press('Escape');

      // El visor de medios, que es donde más cosas se apilan.
      await page.goto('/');
      // Antes iba dentro de un `if (await abrirGaleriaConMedios(page))`, así que
      // sin medios el visor no se comprobaba y el test pasaba igual: un salto
      // en silencio es la peor forma de aprobar.
      await asegurarGaleriaConMedios(page);
      await page.getByRole('button', { name: /^Ver / }).first().click();
      await page.getByRole('dialog').waitFor();
      await esperarAnimaciones(page);
      expect(await desbordaHorizontal(page), `el visor desborda a ${w}px`).toBe(false);
    });
  }
});


/**
 * Los dos casos de §7 que no son un ancho: el zoom al 200% —que es lo que hace
 * quien no ve bien, y multiplica por dos el tamaño de todo sin cambiar el
 * viewport CSS— y el móvil en horizontal, donde la altura se queda en 320px y
 * lo que estaba pegado abajo se come la pantalla.
 */
test.describe('lo último de la pantalla se puede pulsar', () => {
  // En el iPhone la barra de Safari aparece y desaparece al scrollear y `dvh`
  // cambia con ella: un control pegado al borde inferior se mete debajo justo
  // cuando vas a tocarlo. Sobra espacio en blanco; falta un botón inalcanzable.
  const MARGEN_MINIMO = 40;

  for (const { w, h, nombre, tactil } of ANCHOS.filter((a) => a.tactil)) {
    test(`a ${nombre}, el último control queda despegado del borde`, async ({ page }) => {
      expect(tactil).toBe(true);
      await page.setViewportSize({ width: w, height: h });
      await irAlPanel(page);

      for (const { ruta, nombre: pantalla, ancla } of PANTALLAS) {
        await page.goto(ruta);
        if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
        else await page.getByRole('heading', { level: 1 }).waitFor();
        await esperarAnimaciones(page);

        // Hasta que la altura no cambie: la página crece mientras cargan las
        // portadas, y con un solo scroll el final queda más abajo de donde se
        // midió. Mismo error que medir un recuento en movimiento.
        await bajarDelTodo(page);

        const hueco = await page.evaluate(() => {
          const ultimo = document.querySelector('main')?.lastElementChild;
          if (!ultimo) return null;
          return Math.round(window.innerHeight - ultimo.getBoundingClientRect().bottom);
        });
        if (hueco === null) continue;
        expect(hueco, `${pantalla} a ${w}px deja solo ${hueco}px bajo lo último`).toBeGreaterThanOrEqual(
          MARGEN_MINIMO,
        );
      }
    });
  }
});

test.describe('los dos casos que no son un ancho', () => {
  test('con zoom al 200% ninguna pantalla desborda', async ({ page }) => {
    // 200% de zoom sobre 768 se comporta como 384 CSS px con todo al doble.
    await page.setViewportSize({ width: 768, height: 1024 });
    await irAlPanel(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '200%';
    });

    for (const { ruta, nombre, ancla } of PANTALLAS) {
      await page.goto(ruta);
      await page.evaluate(() => {
        document.documentElement.style.zoom = '200%';
      });
      if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
      else await page.getByRole('heading', { level: 1 }).waitFor();
      await esperarAnimaciones(page);

      const fuera = await culpables(page);
      expect(
        await desbordaHorizontal(page),
        `${nombre} desborda con zoom al 200%. Se salen:\n${fuera.join('\n')}`,
      ).toBe(false);
    }
  });

  test('en móvil horizontal (568x320) todo sigue alcanzable', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await irAlPanel(page);

    for (const { ruta, nombre, ancla } of PANTALLAS) {
      await page.goto(ruta);
      if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
      else await page.getByRole('heading', { level: 1 }).waitFor();
      await esperarAnimaciones(page);

      const fuera = await culpables(page);
      expect(
        await desbordaHorizontal(page),
        `${nombre} desborda en horizontal. Se salen:\n${fuera.join('\n')}`,
      ).toBe(false);

      // Con 320px de alto, un pie pegado no puede tapar más de un tercio: si
      // lo hace, no queda sitio para escribir en el campo que está editando.
      const pegado = page.locator('.sticky').first();
      if (await pegado.isVisible().catch(() => false)) {
        const caja = await pegado.boundingBox();
        expect(caja?.height ?? 0, `el pie pegado se come la pantalla en ${nombre}`).toBeLessThan(
          320 / 3,
        );
      }
    }
  });
});

/**
 * La proporción declarada se CUMPLE.
 *
 * `aspect-video` en una caja sin alto fijo no gana a un hijo más alto: `h-full`
 * dentro de una caja con `aspect-ratio` no resuelve, y el alto intrínseco de un
 * póster 9:16 estiraba la portada de una categoría al triple, descuadrando la
 * fila entera. No lo caza «nada se sale de su tarjeta» —la imagen no se sale,
 * empuja— ni un test de DOM, que no maqueta. Solo se ve midiendo.
 */
test.describe('lo que declara una proporción la respeta', () => {
  test('ninguna caja con aspect-ratio se estira', async ({ page }) => {
    await irAlPanel(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const { ruta, nombre, ancla } of PANTALLAS) {
      await page.goto(ruta);
      if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
      else await page.getByRole('heading', { level: 1 }).waitFor();
      await esperarAnimaciones(page);

      const rotas = await page.evaluate(() => {
        const malas: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('*')) {
          const proporcion = getComputedStyle(el).aspectRatio;
          if (proporcion === 'auto' || !proporcion.includes('/')) continue;

          const [a, b] = proporcion.split('/').map((n) => Number(n.trim()));
          if (!a || !b) continue;

          const caja = el.getBoundingClientRect();
          if (caja.width < 8 || caja.height < 8) continue;

          const esperado = caja.width / (a / b);
          // Solo se mira si CRECE. Una caja más BAJA de lo declarado siempre es
          // un `max-height` puesto a mano —`CampoImagen` recorta a 224px a
          // propósito, para que una caja vacía no se coma media hoja— y ese
          // recorte es la intención, no el fallo. El fallo es al revés: un hijo
          // que empuja la caja por encima de su proporción, que es lo que
          // descuadró la rejilla de categorías. 2px de holgura por el redondeo.
          if (caja.height - esperado > 2) {
            malas.push(
              `${el.tagName.toLowerCase()}.${el.className.toString().split(' ').slice(0, 3).join('.')} ` +
                `declara ${proporcion} pero la estiran a ${Math.round(caja.width)}×${Math.round(caja.height)} ` +
                `(debería ${Math.round(caja.width)}×${Math.round(esperado)})`,
            );
          }
        }
        return malas;
      });

      expect(rotas, `en ${nombre}:\n${rotas.join('\n')}`).toEqual([]);
    }
  });
});

/**
 * EL TEMA CLARO NO PUEDE TRAGARSE TEXTO.
 *
 * Los tres fallos que salieron construyéndolo fueron todos el mismo: un color
 * escrito a mano que en oscuro contrastaba y en claro quedaba encima de sí
 * mismo. El chip de «24 medios» en `bone` sobre un velo negro, el relleno del
 * menú en blanco al 7% sobre blanco, el degradado oscuro bajo texto claro.
 * Ninguno lo caza un test de DOM ni el typecheck: solo se ven pintados.
 *
 * Esto mide el contraste real de cada texto contra el fondo que de verdad tiene
 * detrás, en LOS DOS TEMAS. El umbral es el de WCAG AA —4.5:1, y 3:1 para texto
 * grande—, que es el mismo que la paleta dice cumplir.
 */
const TEMAS = ['oscuro', 'claro'] as const;

/** Contrastes por debajo de esto se reportan; el resto no se mira. */
async function textosSinContraste(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const luz = (c: number[]) =>
      c
        .slice(0, 3)
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);

    const leer = (s: string): number[] | null => {
      const n = s.match(/[\d.]+/g)?.map(Number);
      return n && n.length >= 3 ? n : null;
    };

    /** El fondo que de verdad hay detrás: sube hasta el primer opaco y mezcla. */
    const fondoDe = (el: Element): number[] => {
      const capas: number[][] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = leer(getComputedStyle(n).backgroundColor);
        if (!c) continue;
        const alfa = c[3] ?? 1;
        if (alfa === 0) continue;
        capas.push(c);
        if (alfa >= 0.999) break;
      }
      // Se compone de atrás hacia delante.
      return capas.reduceRight(
        (bajo, alto) => {
          const a = alto[3] ?? 1;
          return [0, 1, 2].map((i) => alto[i]! * a + bajo[i]! * (1 - a));
        },
        [255, 255, 255],
      );
    };

    const malos: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      // Solo nodos con texto PROPIO: si no, cada contenedor repite a su hijo.
      const texto = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      if (!texto) continue;

      // Las vistas previas reproducen la LANDING, el resultado de Google y la
      // tarjeta de WhatsApp con los colores de cada uno. Reconocerlos ES el
      // punto: aplicarles nuestra paleta los haría irreconocibles, que es peor
      // que un gris flojo en un trozo de pantalla que nadie lee, solo mira.
      if (el.closest('[aria-label^="Vista previa"]')) continue;

      const est = getComputedStyle(el);
      if (est.visibility === 'hidden' || est.display === 'none') continue;
      if (Number(est.opacity) < 0.95) continue;
      const caja = el.getBoundingClientRect();
      if (caja.width < 2 || caja.height < 2) continue;

      const frente = leer(est.color);
      if (!frente) continue;
      const alfa = frente[3] ?? 1;
      const fondo = fondoDe(el);
      // El color del texto puede ser semitransparente (`text-bone/35`).
      const mezcla = [0, 1, 2].map((i) => frente[i]! * alfa + fondo[i]! * (1 - alfa));

      const [a, b] = [luz(mezcla), luz(fondo)].sort((x, y) => y - x);
      const razon = (a! + 0.05) / (b! + 0.05);

      const px = parseFloat(est.fontSize);
      const grande = px >= 24 || (px >= 18.66 && Number(est.fontWeight) >= 700);
      const minimo = grande ? 3 : 4.5;

      if (razon < minimo) {
        malos.push(
          `«${texto.slice(0, 40)}» ${razon.toFixed(2)}:1 (pide ${minimo}) · ` +
            `${est.color} sobre rgb(${fondo.map(Math.round).join(',')}) · ${el.className.toString().split(' ').slice(0, 3).join('.')}`,
        );
      }
    }
    return [...new Set(malos)];
  });
}

test.describe('el tema no se traga el texto', () => {
  for (const tema of TEMAS) {
    test(`en ${tema}, todo texto contrasta lo que la paleta promete`, async ({ page }) => {
      await page.addInitScript((t) => {
        window.localStorage.setItem('jamesfilm:tema', t);
      }, tema);
      await page.setViewportSize({ width: 1280, height: 900 });
      await irAlPanel(page);

      for (const { ruta, nombre, ancla } of PANTALLAS) {
        await page.goto(ruta);
        if (ancla) await page.getByLabel(ancla).first().waitFor({ timeout: 15_000 });
        else await page.getByRole('heading', { level: 1 }).waitFor();
        await esperarAnimaciones(page);

        const malos = await textosSinContraste(page);
        expect(malos, `${nombre} en ${tema}:\n${malos.join('\n')}`).toEqual([]);
      }
    });
  }
});
