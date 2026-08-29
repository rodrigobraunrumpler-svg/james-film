'use client';

import {
  Film,
  Images,
  LogOut,
  Menu,
  MessageSquareQuote,
  Package,
  Settings,
  Tags,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Drawer } from 'vaul';
import { eventosQueCaben, useUsoAlmacenamiento } from '@/lib/almacenamiento';
import { tamano } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

/**
 * La lista de galerías vive en `/` y el editor en `/galerias/[id]`, así que una
 * comparación exacta deja el menú SIN nada marcado en cuanto abres una galería
 * —que es donde James pasa el rato— y no hay forma de saber dónde estás.
 *
 * Para el resto basta el prefijo: `/paquetes` cubriría `/paquetes/nuevo` el día
 * que exista. Se compara con la barra incluida para que `/paquetesx` no cuente.
 */
export function esActivo(ruta: string, href: string): boolean {
  if (href === '/') return ruta === '/' || ruta.startsWith('/galerias');
  return ruta === href || ruta.startsWith(`${href}/`);
}

const ENLACES = [
  { href: '/', etiqueta: 'Galerías', Icono: Images },
  { href: '/categorias', etiqueta: 'Categorías', Icono: Tags },
  { href: '/paquetes', etiqueta: 'Paquetes', Icono: Package },
  { href: '/testimonios', etiqueta: 'Testimonios', Icono: MessageSquareQuote },
  { href: '/configuracion', etiqueta: 'Configuración', Icono: Settings },
] as const;

/** El logotipo: 11px con mucho espaciado. Es una marca, no un titular. */
function Marca() {
  return (
    <span className="flex items-center gap-2.5 px-2.5">
      <Film className="text-brass size-[18px] shrink-0" aria-hidden />
      <span className="text-xs font-semibold tracking-[0.2em]">JAMES FILM</span>
    </span>
  );
}

function Enlaces({ alNavegar }: { alNavegar?: () => void }) {
  const ruta = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Principal">
      {ENLACES.map(({ href, etiqueta, Icono }) => {
        const activo = esActivo(ruta, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={alNavegar}
            aria-current={activo ? 'page' : undefined}
            // h-11 (44px) es el mínimo táctil de §7 y solo aplica en el drawer;
            // en el sidebar de escritorio la fila baja a los 34px de la guía.
            className={cn(
              'flex h-11 items-center gap-2.5 rounded-md px-2.5 transition-colors duration-150 lg:h-[34px]',
              activo ? 'bg-active text-bone font-medium' : 'text-ash hover:bg-card-hover',
            )}
          >
            <Icono
              className={cn('size-4 shrink-0', activo ? 'text-brass' : 'text-ash')}
              aria-hidden
            />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * §9 no lo pide, pero es el único aviso que James tiene antes de quedarse sin
 * sitio a mitad de una boda. En eventos y no en gigas: «6.8 GB libres» hay que
 * traducirlo, «quedan unos 29 eventos» no.
 */
function MedidorEspacio() {
  const { data } = useUsoAlmacenamiento();
  if (!data) return null;

  const { usedBytes, quotaBytes } = data.data;
  const porcentaje = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));
  const eventos = eventosQueCaben(usedBytes, quotaBytes);
  const apurado = porcentaje >= 85;

  return (
    <div className="border-line flex flex-col gap-2 border-t px-4.5 py-4">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-ash">Espacio</span>
        <span>
          {tamano(usedBytes)} / {tamano(quotaBytes)}
        </span>
      </div>
      <div className="bg-line h-1 overflow-hidden rounded-full">
        <div
          // `transform` y no `width`: animar el ancho reflowea la barra en
          // cada tick mientras James sube.
          className={cn(
            'h-full w-full origin-left transition-transform duration-300',
            apurado ? 'bg-danger' : 'bg-brass',
          )}
          style={{ transform: `scaleX(${porcentaje / 100})` }}
        />
      </div>
      <span className="text-muted text-xs">
        {eventos > 0 ? `Quedan unos ${eventos} eventos` : 'Casi sin espacio'}
      </span>
    </div>
  );
}

function PiePerfil() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  return (
    <div className="border-line flex items-center gap-2.5 border-t px-4.5 py-3.5">
      <span
        aria-hidden
        className="border-line-strong bg-active text-brass flex size-[26px] shrink-0 items-center justify-center rounded-full border text-xs"
      >
        J
      </span>
      <span className="text-ash min-w-0 flex-1 truncate text-sm">James</span>
      <button
        type="button"
        disabled={saliendo}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        onClick={async () => {
          setSaliendo(true);
          // Revoca en la API además de borrar la cookie: si solo borrara la cookie,
          // el refresh seguiría vivo 30 días.
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          router.replace('/login');
          router.refresh();
        }}
        className="text-ash hover:bg-card-hover hover:text-bone flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-50 lg:size-8"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Sidebar fijo desde `lg`; por debajo, un drawer. §7: en móvil los paneles van a
 * hoja, no a menú comprimido. `vaul` da el arrastre para cerrar que se siente
 * nativo en iOS, que es donde James lo usa.
 *
 * El sidebar es `chrome`, MÁS CLARO que el `content` de la derecha: así se
 * separa sin necesitar una línea, que es el truco que sostiene la paleta.
 */
export function Navegacion() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <header className="border-line bg-chrome flex items-center gap-2 border-b px-3 py-2 lg:hidden">
        <Drawer.Root open={abierto} onOpenChange={setAbierto} direction="left">
          <Drawer.Trigger asChild>
            <button
              type="button"
              aria-label="Abrir menú"
              className="text-bone hover:bg-card-hover flex size-11 items-center justify-center rounded-md transition-colors duration-150"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="bg-well/70 fixed inset-0" />
            <Drawer.Content className="border-line bg-chrome fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r">
              {/* Sin `asChild`: Drawer.Title pinta un h2 y esa es la cabecera
                  accesible del panel. Envolverlo en un div la perdería. */}
              <Drawer.Title className="pt-5 pb-5">
                <Marca />
              </Drawer.Title>
              <div className="px-2.5">
                <Enlaces alNavegar={() => setAbierto(false)} />
              </div>
              <div className="mt-auto">
                <MedidorEspacio />
                <PiePerfil />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
        <Marca />
      </header>

      <aside className="border-line bg-chrome hidden w-58 shrink-0 flex-col border-r lg:flex">
        <div className="px-2.5 pt-5 pb-5">
          <Marca />
        </div>
        <div className="px-2.5">
          <Enlaces />
        </div>
        <div className="mt-auto">
          <PiePerfil />
        </div>
      </aside>
    </>
  );
}
