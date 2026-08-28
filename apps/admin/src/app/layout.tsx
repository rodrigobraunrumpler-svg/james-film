import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

// Autoalojada por next/font: sin petición a Google Fonts y sin CLS.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'James Film · Admin',
  description: 'Panel de administración de James Film',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // SIN esto, `env(safe-area-inset-bottom)` vale 0 en el iPhone: el CSS compila,
  // se ve bien en el emulador, y la barra de publicación queda debajo del
  // indicador de inicio.
  viewportFit: 'cover',
  // Sin maximumScale ni userScalable: §7 exige que el zoom al 200% funcione.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-dvh bg-white font-sans text-neutral-900 antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
