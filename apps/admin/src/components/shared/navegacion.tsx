'use client';

import { Film, Images, LogOut, Menu, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils/cn';

const ENLACES = [
  { href: '/', etiqueta: 'Galerías', Icono: Images },
  { href: '/configuracion', etiqueta: 'Configuración', Icono: Settings },
] as const;

function Enlaces({ alNavegar }: { alNavegar?: () => void }) {
  const ruta = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Principal">
      {ENLACES.map(({ href, etiqueta, Icono }) => {
        const activo = ruta === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={alNavegar}
            aria-current={activo ? 'page' : undefined}
            // min-h-11 = 44px: el mínimo táctil que exige §7.
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
              activo ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100',
            )}
          >
            <Icono className="size-5 shrink-0" aria-hidden />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

function BotonSalir() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  return (
    <button
      type="button"
      disabled={saliendo}
      onClick={async () => {
        setSaliendo(true);
        // Revoca en la API además de borrar la cookie: si solo borrara la cookie,
        // el refresh seguiría vivo 30 días.
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        router.replace('/login');
        router.refresh();
      }}
      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
    >
      <LogOut className="size-5 shrink-0" aria-hidden />
      {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}

/**
 * Sidebar fijo desde `lg`; por debajo, un drawer. §7: en móvil los paneles van a
 * hoja, no a menú comprimido. `vaul` da el arrastre para cerrar que se siente
 * nativo en iOS, que es donde James lo usa.
 */
export function Navegacion() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <header className="flex items-center gap-3 border-b px-4 py-3 lg:hidden">
        <Drawer.Root open={abierto} onOpenChange={setAbierto} direction="left">
          <Drawer.Trigger asChild>
            <button
              type="button"
              aria-label="Abrir menú"
              className="flex size-11 items-center justify-center rounded-md hover:bg-neutral-100"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40" />
            <Drawer.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-6 bg-white p-4">
              <Drawer.Title className="flex items-center gap-2 px-3 text-lg font-semibold">
                <Film className="size-5" aria-hidden />
                James Film
              </Drawer.Title>
              <Enlaces alNavegar={() => setAbierto(false)} />
              <div className="mt-auto">
                <BotonSalir />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
        <span className="font-semibold">James Film</span>
      </header>

      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r p-4 lg:flex">
        <span className="flex items-center gap-2 px-3 text-lg font-semibold">
          <Film className="size-5" aria-hidden />
          James Film
        </span>
        <Enlaces />
        <div className="mt-auto">
          <BotonSalir />
        </div>
      </aside>
    </>
  );
}
