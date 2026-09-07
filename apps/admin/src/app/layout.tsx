import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import { SCRIPT_TEMA } from '@/lib/tema';
import { ToasterDelTema } from '@/components/shared/toaster-del-tema';
import './globals.css';

// Autoalojada por next/font: sin petición a Google Fonts y sin CLS.
// La variable la consume `--font-sans` en globals.css, no el `className`.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Solo 400 y 800: Bricolage no tiene cursiva y el admin la usa en un único
// sitio —el saludo del login—, así que cargar la variable entera sería pagar
// un peso que nadie ve.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '800'],
  variable: '--font-bricolage',
});

export const metadata: Metadata = {
  title: 'James Film · Admin',
  description: 'Panel de administración de James Film',
  // Añadido a la pantalla de inicio del iPhone, el título de la app es este.
  appleWebApp: { capable: true, title: 'James Film', statusBarStyle: 'black-translucent' },
  // El admin NO se indexa: es privado y no tiene nada que buscar.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // SIN esto, `env(safe-area-inset-bottom)` vale 0 en el iPhone: el CSS compila,
  // se ve bien en el emulador, y la barra de publicación queda debajo del
  // indicador de inicio.
  viewportFit: 'cover',
  // Sin maximumScale ni userScalable: §7 exige que el zoom al 200% funcione.
  // El color de la barra de estado en standalone. DOS, uno por tema: con uno
  // solo, en claro el iPhone pinta una franja casi negra sobre un panel blanco.
  // Es el `content` del admin, no el `void` de la landing.
  // Respaldo por si el script no llega a correr. El que manda es el `<meta>`
  // SIN media que escribe `SCRIPT_TEMA`: aquí el tema lo elige `data-tema`, no
  // `prefers-color-scheme`, y con el iPhone en oscuro y el panel en claro este
  // par dejaría la barra de estado negra sobre una pantalla blanca.
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0f0d0c' },
    { media: '(prefers-color-scheme: light)', color: '#f7f6f3' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning`: el script de abajo escribe `data-tema` en el
    // <html> antes de que React hidrate, así que el atributo del servidor y el
    // del cliente no coinciden **a propósito**. Sin esto React avisa por
    // consola en cada carga. Solo afecta a este elemento, no al árbol.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${bricolage.variable}`}
    >
      <head>
        {/*
          Bloqueante y en el <head>: pone el tema ANTES del primer pintado. En
          un efecto, la pantalla se pintaría oscura y saltaría a clara — un
          parpadeo en cada carga, y en el móvil de James medio segundo de negro.
          Es la única razón por la que aquí hay un script en línea.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      {/* `text-base` = 13px. Sin él, TODO lo que no declara tamaño hereda los 16px
          de Preflight: botones, campos y avisos salían un 23% más grandes de lo
          diseñado y la pantalla se leía espaciada en vez de densa. */}
      <body className="bg-content text-bone min-h-dvh font-sans text-base antialiased">
        {children}
        {/* Arriba a propósito: abajo chocaría con la barra de subidas, que es
            `sticky` y está justo donde caería el toast. */}
        <ToasterDelTema />
      </body>
    </html>
  );
}
