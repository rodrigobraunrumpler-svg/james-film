import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
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
  // El color de la barra de estado en standalone: el `content` del admin, no
  // el `void` de la landing — si no, se ve una franja más oscura arriba.
  themeColor: '#0F0D0C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${bricolage.variable}`}>
      {/* `text-base` = 13px. Sin él, TODO lo que no declara tamaño hereda los 16px
          de Preflight: botones, campos y avisos salían un 23% más grandes de lo
          diseñado y la pantalla se leía espaciada en vez de densa. */}
      <body className="bg-content text-bone min-h-dvh font-sans text-base antialiased">
        {children}
        {/* Arriba a propósito: abajo chocaría con la barra de subidas, que es
            `sticky` y está justo donde caería el toast. */}
        <Toaster
          position="top-center"
          theme="dark"
          closeButton
          // El toast por defecto de sonner en oscuro es casi negro sobre un
          // panel casi negro: se lee como un agujero. Con `card` y el borde de
          // `line-strong` se separa del fondo, que es lo que tiene que hacer
          // algo que aparece encima de todo.
          toastOptions={{
            classNames: {
              toast:
                'bg-card! border-line-strong! text-bone! rounded-card! gap-3! shadow-2xl shadow-black/50',
              title: 'font-medium',
              description: 'text-ash!',
              icon: 'text-brass',
              actionButton: 'bg-transparent! border border-brass text-brass! font-medium',
              cancelButton: 'bg-transparent! text-ash!',
              closeButton:
                'bg-card! border-line-strong! text-ash! hover:text-bone! hover:bg-card-hover!',
              error: 'border-danger-line! [&_[data-icon]]:text-danger',
              success: '[&_[data-icon]]:text-brass',
            },
          }}
        />
      </body>
    </html>
  );
}
