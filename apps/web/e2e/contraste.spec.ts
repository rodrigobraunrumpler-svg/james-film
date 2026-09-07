import { expect, test } from '@playwright/test';
import { conTema, RUTAS, recorrerEntera, TEMAS } from './apoyo';

/**
 * EL TEMA CLARO NO PUEDE TRAGARSE TEXTO.
 *
 * Es el mismo test que cazó los tres fallos del tema claro del admin, y aquí
 * hace más falta todavía: en los prototipos de esta landing el fallo se coló
 * CUATRO veces —hero, cifra del bento, panel de cierre y portadas de
 * categoría—, siempre igual: un fondo oscuro que HEREDA su color de texto.
 * En oscuro funciona por accidente, porque la raíz ya es clara; en claro deja
 * texto negro sobre negro. Ni el typecheck ni un test de DOM ven un color.
 *
 * El listón es AA —4.5:1, y 3:1 para texto grande—, y aquí importa más que en
 * el admin: esto se lee al sol, en una pantalla barata, con cincuenta años.
 */
async function textosSinContraste(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const luz = (c: number[]) =>
      c
        .slice(0, 3)
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);

    /**
     * A sRGB, dejando que convierta el NAVEGADOR.
     *
     * Sacar los números con una expresión regular es lo que hace el test del
     * admin, y está mal: Tailwind 4 sirve `bg-void/90` como
     * `oklab(0.985 -0.00005 0.004 / 0.9)`, y leer eso como RGB 0-255 da casi
     * negro. El test acusaba a la barra del pie de 1.04:1 cuando de verdad es
     * blanca. Un test que miente hacia el rojo se acaba desactivando.
     *
     * Se pinta el color sobre blanco y sobre negro y se despeja: sale el color
     * y su alfa, exactos, sea cual sea la sintaxis —oklab, color(), lab, la
     * que venga—.
     */
    const leer = (() => {
      const l = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      l.canvas.width = l.canvas.height = 1;
      const sobre = (fondo: string, color: string) => {
        l.globalCompositeOperation = 'copy';
        l.fillStyle = fondo;
        l.fillRect(0, 0, 1, 1);
        l.globalCompositeOperation = 'source-over';
        l.fillStyle = color;
        l.fillRect(0, 0, 1, 1);
        return [...l.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      return (s: string): number[] | null => {
        if (!s || s === 'none') return null;
        const blanco = sobre('#fff', s);
        const negro = sobre('#000', s);
        // a = 1 - (sobreBlanco - sobreNegro) / 255, promediando los tres canales.
        const a =
          1 -
          [0, 1, 2].reduce((acc, i) => acc + (blanco[i]! - negro[i]!) / 255, 0) / 3;
        if (a <= 0.001) return [0, 0, 0, 0];
        return [...[0, 1, 2].map((i) => negro[i]! / a), a];
      };
    })();

    /**
     * Los fondos que de verdad hay detrás. Devuelve VARIOS porque un degradado
     * no tiene un color: tiene un recorrido, y el texto tiene que leerse sobre
     * todo él.
     *
     * Mirar solo `background-color` dejaba pasar justo el sitio más peligroso:
     * el panel de cierre pinta su oscuro con `linear-gradient`, que es una
     * `background-image`. El test lo saltaba y creía ver el blanco del `body`
     * detrás — acusaba de 1.10:1 a un titular que se lee perfectamente, y
     * habría dejado pasar uno que de verdad estuviera mal.
     */
    const fondosDe = (el: Element): number[][] => {
      const capas: number[][] = [];
      const paradas: number[][] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        /**
         * Un bloque puede apoyarse en un velo que es su HERMANO —una capa
         * absoluta encima de la foto—, y subir por ancestros no lo encuentra
         * nunca: el test veía el blanco del `body` bajo el titular del hero y
         * lo acusaba de 1.10:1 cuando está sobre negro.
         *
         * Cuando eso pasa, el componente DECLARA sobre qué se apoya. Es
         * explícito a propósito: obliga a pensarlo al escribirlo, en vez de
         * dejar que el test adivine y se equivoque en silencio.
         */
        const declarado = (n as HTMLElement).dataset?.fondoMovil;
        // Solo en OSCURO: en claro ese bloque no va sobre el velo, va sobre la
        // página, y ahí el fondo real es el del tema.
        const enOscuro = document.documentElement.dataset.tema !== 'claro';
        if (declarado && enOscuro && innerWidth < 1024) {
          const c = leer(declarado);
          if (c) return [c.slice(0, 3)];
        }

        const est = getComputedStyle(n);

        // Un degradado tapa lo de detrás: se cogen sus paradas y se corta.
        const img = est.backgroundImage;
        if (img && img !== 'none' && img.includes('gradient')) {
          for (const trozo of img.match(/(?:rgba?|oklab|oklch|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}/gi) ?? []) {
            const c = leer(trozo);
            if (c && (c[3] ?? 1) > 0.5) paradas.push(c);
          }
          if (paradas.length) break;
        }

        const c = leer(est.backgroundColor);
        if (!c) continue;
        const alfa = c[3] ?? 1;
        if (alfa === 0) continue;
        capas.push(c);
        if (alfa >= 0.999) break;
      }

      const componer = (base: number[]) =>
        capas.reduceRight(
          (bajo, alto) => {
            const a = alto[3] ?? 1;
            return [0, 1, 2].map((i) => alto[i]! * a + bajo[i]! * (1 - a));
          },
          base,
        );

      return paradas.length ? paradas.map((p) => componer(p)) : [componer([255, 255, 255])];
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

      /**
       * Lo `aria-hidden` que además NO se puede pulsar queda fuera, y es la
       * excepción que la propia WCAG 1.4.3 hace a los componentes inactivos.
       * En esta web son los días de FUERA del mes en el calendario: están
       * apagados a propósito —«no es que esté libre, es que no se sabe»— y no
       * se anuncian ni se tocan. Es una excepción estrecha: cualquier cosa
       * pulsable sigue midiéndose aunque lleve `aria-hidden`.
       */
      if (el.closest('[aria-hidden="true"]') && !el.closest('a, button, [tabindex]')) continue;

      const est = getComputedStyle(el);
      if (est.visibility === 'hidden' || est.display === 'none') continue;
      if (Number(est.opacity) < 0.95) continue;
      const caja = el.getBoundingClientRect();
      if (caja.width < 2 || caja.height < 2) continue;

      const frente = leer(est.color);
      if (!frente) continue;
      const alfa = frente[3] ?? 1;

      const px = parseFloat(est.fontSize);
      const grande = px >= 24 || (px >= 18.66 && Number(est.fontWeight) >= 700);
      const minimo = grande ? 3 : 4.5;

      // El PEOR punto del degradado manda: se tiene que leer en todo él.
      let razon = Infinity;
      let fondo: number[] = [255, 255, 255];
      for (const f of fondosDe(el)) {
        const mezcla = [0, 1, 2].map((i) => frente[i]! * alfa + f[i]! * (1 - alfa));
        const [a, b] = [luz(mezcla), luz(f)].sort((x, y) => y - x);
        const r = (a! + 0.05) / (b! + 0.05);
        if (r < razon) {
          razon = r;
          fondo = f;
        }
      }

      if (razon < minimo) {
        malos.push(
          `«${texto.slice(0, 40)}» ${razon.toFixed(2)}:1 (pide ${minimo}) · ` +
            `${est.color} sobre rgb(${fondo.map(Math.round).join(',')}) · ` +
            `${el.tagName.toLowerCase()}.${el.className.toString().split(' ').slice(0, 3).join('.')}`,
        );
      }
    }
    return [...new Set(malos)];
  });
}

for (const tema of TEMAS) {
  for (const ruta of RUTAS) {
    test(`contraste AA · ${ruta} · tema ${tema}`, async ({ page }) => {
      await conTema(page, tema);
      await page.goto(ruta);
      // Hay que RECORRERLA: con la entrada por observador, media página está a
      // opacidad 0 al cargar y el test la saltaría creyendo que no hay nada.
      await recorrerEntera(page);

      const malos = await textosSinContraste(page);
      expect(malos, `Texto sin contraste en ${ruta} (${tema}):\n  ${malos.join('\n  ')}`).toEqual(
        [],
      );
    });
  }
}
