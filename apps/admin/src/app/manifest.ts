import type { MetadataRoute } from 'next';

/**
 * `manifest.ts` y no un `manifest.json` a mano: tipado con
 * `MetadataRoute.Manifest`, así una clave mal escrita no compila.
 *
 * Lo que compra: James **añade el admin a la pantalla de inicio del iPhone** y
 * se abre sin barra del navegador. Importa más de lo que parece — con
 * `display: 'standalone'` gana la altura de la barra de direcciones, que en un
 * teléfono editando una galería es bastante pantalla.
 *
 * `orientation: 'portrait'` no se fija: §7 exige que el móvil en horizontal
 * funcione, y bloquearlo sería contradecirlo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'James Film · Admin',
    short_name: 'James Film',
    description: 'Sube reels, edita paquetes y publica desde el móvil.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0908',
    theme_color: '#0A0908',
    lang: 'es-PE',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
      // `maskable` para que Android no lo meta en un recuadro blanco.
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
