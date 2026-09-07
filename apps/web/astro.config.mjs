// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';

const SITIO = process.env.PUBLIC_SITE_URL ?? 'https://jamesfilm.pe';

/**
 * QUE UN DEPLOY MAL CONFIGURADO NO SALGA, en vez de salir roto y callado.
 *
 * El build empotra dos hosts que vienen de variables de entorno: `PUBLIC_API_URL`
 * —donde se registra el clic a WhatsApp— y el `CDN_BASE_URL` con el que la API
 * construye las URL de los medios. En local los dos son `localhost`, y el CSP de
 * `public/_headers` solo deja pasar `api.jamesfilm.pe` y `media.jamesfilm.pe`.
 *
 * Un `dist/` construido sin esas variables se despliega sin protestar y entonces
 * pasan LAS DOS cosas a la vez, en silencio: las imágenes las bloquea el CSP —el
 * portafolio se ve vacío, que parece «no ha subido nada»— y el `POST /track/whatsapp`
 * también, así que el panel dice «0 clics» y parece que la web no funciona. El
 * único rastro está en la consola de quien visita, o sea en ninguna parte.
 *
 * **QUÉ COMPRUEBA, exactamente**, porque la primera versión decía una cosa y
 * hacía otra: (1) que no quede ni una URL `http://` en el build —en producción
 * eso nunca es una decisión, es una variable que faltó— y (2) que los hosts de
 * `PUBLIC_API_URL` y `CDN_BASE_URL` estén entre los que el CSP declara.
 *
 * NO recorre todos los hosts `https://` comparándolos con el CSP, y es a
 * propósito: `wa.me`, Instagram y TikTok son destinos de navegación y
 * `schema.org` es solo el `@context` de un JSON-LD que nadie descarga. El CSP
 * no aplica a ninguno, así que compararlos daría falsos positivos que enseñan a
 * ignorar el aviso.
 *
 * Solo ABORTA en el deploy de verdad —Cloudflare Pages define `CF_PAGES`—; en
 * local avisa y sigue, porque ahí `localhost` es exactamente lo que toca.
 *
 * @returns {import('astro').AstroIntegration}
 */
function guardiaDeHosts() {
  return {
    name: 'guardia-de-hosts',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        // SOLO la línea del CSP, no el fichero entero: hoy no hay ninguna URL
        // en los comentarios, pero el día que alguien escriba una para
        // explicar algo, el guardia daría ese host por permitido sin que nadie
        // lo haya autorizado.
        const cabeceras = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8');
        const csp = cabeceras.split('\n').find((l) => l.includes('Content-Security-Policy:')) ?? '';
        const permitidos = [...csp.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]);

        /** @type {Set<string>} */
        const sospechosos = new Set();

        /** @param {URL} carpeta */
        const revisar = (carpeta) => {
          for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
            const hijo = new URL(`${entrada.name}${entrada.isDirectory() ? '/' : ''}`, carpeta);
            if (entrada.isDirectory()) revisar(hijo);
            else if (/\.(html|js|json|xml)$/.test(entrada.name)) {
              for (const m of readFileSync(hijo, 'utf8').matchAll(/http:\/\/[a-zA-Z0-9.:-]+/g)) {
                sospechosos.add(m[0].replace(/\/$/, ''));
              }
            }
          }
        };
        revisar(dir);

        for (const nombre of ['PUBLIC_API_URL', 'CDN_BASE_URL']) {
          const url = process.env[nombre];
          // Sin definir es el caso MÁS probable en un despliegue nuevo, y hay
          // que nombrarlo: si solo se dijera «encontré http://localhost:3000»,
          // el mensaje describe el síntoma y no la variable que falta.
          if (!url) sospechosos.add(`${nombre} sin definir`);
          else if (!permitidos.some((p) => url.startsWith(p))) sospechosos.add(`${nombre}=${url}`);
        }

        if (sospechosos.size === 0) return;
        const mensaje =
          `Hosts sin cifrar o fuera del CSP de public/_headers: ${[...sospechosos].join(', ')}. ` +
          'Con esto desplegado, las imágenes y el registro del clic a WhatsApp se bloquean en ' +
          'silencio. Revisa PUBLIC_API_URL y CDN_BASE_URL en las variables del build.';

        if (process.env.CF_PAGES) throw new Error(mensaje);
        logger.warn(`${mensaje} (en local es normal; en Pages abortaría)`);
      },
    },
  };
}

export default defineConfig({
  // Hace falta para el sitemap y para las URL canónicas. Sin él, Astro no
  // puede generar ninguna de las dos y el SEO se queda a medias sin avisar.
  site: SITIO,

  // ESTÁTICO y explícito. Es el defecto, pero escribirlo evita que un
  // adaptador añadido de pasada convierta la web en servidor sin que nadie
  // lo decida — y con ello se iría el «cero servidor en runtime».
  output: 'static',

  build: {
    /**
     * `'auto'` — y con una advertencia, porque el comentario de antes mentía.
     *
     * `'auto'` solo mete dentro las hojas de menos de 4 KB, y la de esta web
     * son ~48 KB en crudo: **nunca se ha inlineado ni una vez**, así que la
     * «petición menos en el camino del LCP» que prometía este sitio no estaba
     * ocurriendo.
     *
     * Se probó `'always'` y **se descartó midiendo**: 390×844@3x, CPU 4×,
     * 1,6 Mbps, RTT 300 ms, mediana de siete cargas sobre `dist/` →
     * **876 ms con `'auto'` y 872 con `'always'`**. Cuatro milisegundos no son
     * una mejora, y el documento engordaba ~8 KB en cada una de las diez
     * páginas. El LCP es el `<h1>` y no lo estaba reteniendo el CSS.
     *
     * Si algún día se toca esto, se toca con una medición al lado.
     */
    inlineStylesheets: 'auto',
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    guardiaDeHosts(),
    sitemap({
      /**
       * FUERA DEL SITEMAP LO QUE LLEVA `noindex`.
       *
       * Se estaban declarando `/trabajos/` y `/testimonios/` —que hoy salen con
       * `noindex,follow` porque no tienen nada que enseñar— y eso le dice a
       * Google «indexa esto» y «no indexes esto» sobre la misma URL. Una señal
       * contradictoria no es medio buena: es ruido en el único sitio donde el
       * rastreador te escucha.
       *
       * **La condición sale del HTML CONSTRUIDO, no de una copia de la regla.**
       * Podría preguntársele a la API desde aquí, pero entonces «está vacía»
       * viviría en dos sitios y el día que uno cambie el otro miente. El
       * `filter` de esta integración corre en `astro:build:done`, o sea con
       * `dist/` ya escrito: la página decide y el sitemap obedece.
       *
       * Sin `lastmod`: sería la fecha del build, o sea «todas cambiaron hoy» en
       * cada despliegue. Un `lastmod` que miente lo aprende Google y deja de
       * mirarlo, y entonces no sirve el día que sí sea verdad.
       */
      filter: (pagina) => {
        const ruta = pagina.replace(SITIO, '').replace(/^\/|\/$/g, '');
        const archivo = new URL(`./dist/${ruta ? `${ruta}/` : ''}index.html`, import.meta.url);
        try {
          return !readFileSync(archivo, 'utf8').includes('name="robots" content="noindex');
        } catch {
          // Una ruta sin `index.html` propio (una redirección, un fichero
          // suelto): no es asunto de este filtro y se deja pasar.
          return true;
        }
      },
    }),
  ],
});
