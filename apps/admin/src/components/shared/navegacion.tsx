'use client';

import {
  CalendarDays,
  Film,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Layers,
  MessageSquareQuote,
  Package,
  Search,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Drawer } from 'vaul';
import { BuscadorGlobal } from '@/features/buscador/components/buscador-global';
import { useAtajoBuscador } from '@/features/buscador/hooks/use-buscador';
import { Pista } from '@/components/shared/pista';
import { SelectorTema } from '@/components/shared/selector-tema';
import { useTema } from '@/lib/use-tema';
import { useRecuentosMenu } from '@/lib/catalogo/recuentos';
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
  { href: '/', etiqueta: 'Galerías', Icono: Images, cuenta: 'galerias' },
  { href: '/panel', etiqueta: 'Panel', Icono: LayoutDashboard, cuenta: null },
  { href: '/categorias', etiqueta: 'Categorías', Icono: Layers, cuenta: 'categorias' },
  { href: '/paquetes', etiqueta: 'Paquetes', Icono: Package, cuenta: 'paquetes' },
  {
    href: '/testimonios',
    etiqueta: 'Testimonios',
    Icono: MessageSquareQuote,
    cuenta: 'testimonios',
  },
  // Sin recuento: «3 días ocupados» no es un número que quiera ver de reojo, y
  // los recuentos del menú salen de las claves de caché de cada pantalla —éste
  // obligaría a una petición más por navegación para un dato que no se decide
  // desde aquí.
  { href: '/disponibilidad', etiqueta: 'Disponibilidad', Icono: CalendarDays, cuenta: null },
  { href: '/configuracion', etiqueta: 'Configuración', Icono: Settings, cuenta: null },
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

/**
 * El disparador del ⌘K. Vive en el MENÚ y no en cada pantalla: desde cualquier
 * sitio se llega a cualquier sitio sin volver atrás, que es lo que quita la
 * sensación de perderse. Con el atajo escrito al lado —si no se ve, no existe.
 */
function BotonBuscar({ alAbrir }: { alAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={alAbrir}
      className="border-line bg-content text-muted hover:border-line-hover hover:text-ash entra rounded-control mx-2.5 mb-3.5 flex h-11 items-center gap-2 px-2.5 text-left text-sm transition-colors duration-150 lg:h-8"
      style={{ '--i': 1 } as React.CSSProperties}
    >
      <Search className="size-[13px] shrink-0" aria-hidden />
      <span className="flex-1 truncate">Buscar o ir a…</span>
      <kbd className="border-line-strong hidden shrink-0 rounded border px-1.5 py-px text-[10px] lg:inline">
        ⌘K
      </kbd>
    </button>
  );
}

function Enlaces({ alNavegar }: { alNavegar?: () => void }) {
  const ruta = usePathname();
  const recuentos = useRecuentosMenu();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Principal">
      {ENLACES.map(({ href, etiqueta, Icono, cuenta }, i) => {
        const activo = esActivo(ruta, href);
        const n = cuenta ? recuentos[cuenta] : null;
        return (
          <Link
            key={href}
            href={href}
            onClick={alNavegar}
            aria-current={activo ? 'page' : undefined}
            // h-11 (44px) es el mínimo táctil de §7 y solo aplica en el drawer;
            // en el sidebar de escritorio la fila baja a los 34px de la guía.
            className={cn(
              'entra flex h-11 items-center gap-2.5 rounded-md px-2.5 transition-colors duration-150 lg:h-[34px]',
              // El filo de latón a la izquierda. `box-shadow` y no un borde: un
              // borde de 2px empujaría el icono 2px a la derecha SOLO en el
              // activo, y el menú entero bailaría al navegar.
              activo
                ? 'bg-active text-bone font-medium shadow-[inset_2px_0_0_var(--color-brass)]'
                : 'text-ash hover:bg-card-hover',
            )}
            style={{ '--i': i + 2 } as React.CSSProperties}
          >
            <Icono
              className={cn('size-4 shrink-0', activo ? 'text-brass' : 'text-ash')}
              aria-hidden
            />
            <span className="flex-1 truncate">{etiqueta}</span>
            {/* Qué hay dentro ANTES de entrar. Se esconde mientras carga en vez
                de pintar un 0: un cero es un dato, y aquí sería mentira. */}
            {n !== null && n !== undefined && (
              <span
                className={cn('shrink-0 text-xs tabular-nums', activo ? 'text-ash' : 'text-muted')}
              >
                {n}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/*
 * El medidor de espacio VIVÍA AQUÍ y se ha quitado: el Panel ya lo cuenta en
 * su tarjeta, y tenerlo en los dos sitios daba dos verdades del mismo número
 * con dos formatos distintos («19 MB / 10 GB» arriba, «19 MB de 10 GB» abajo).
 * El pie del menú se queda con lo que de verdad se toca —perfil, tema, salir—
 * y recupera unos 70px de alto, que en el móvil de James son una fila más de
 * menú visible sin scroll.
 */

function PiePerfil() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const { tema, elegir, listo } = useTema();

  return (
    // DOS filas, no una que se parte. En los 232px del sidebar, la identidad y
    // los tres botones del tema no caben en la misma línea: con `flex-wrap` el
    // nombre se truncaba a «Ja…» y el de cerrar sesión caía solo a una segunda
    // fila medio vacía. Apilado, el nombre se lee entero y los controles
    // comparten la fila de abajo.
    <div className="border-line flex flex-col gap-2 border-t px-4.5 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="border-line-strong bg-active text-bone flex size-[26px] shrink-0 items-center justify-center rounded-full border text-xs"
        >
          J
        </span>
        <span className="text-bone min-w-0 flex-1 truncate text-sm font-medium">James</span>
      </div>

      <div className="flex items-center gap-2.5">
        <SelectorTema tema={tema} elegir={elegir} listo={listo} />
        <Pista texto="Cerrar sesión" className="ml-auto shrink-0">
          <button
            type="button"
            disabled={saliendo}
            aria-label="Cerrar sesión"
            onClick={async () => {
              setSaliendo(true);
              // Revoca en la API además de borrar la cookie: si solo borrara la
              // cookie, el refresh seguiría vivo 30 días.
              await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
              router.replace('/login');
              router.refresh();
            }}
            className="text-ash hover:bg-card-hover hover:text-bone flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-50 lg:size-8"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </Pista>
      </div>
    </div>
  );
}

/**
 * Sidebar fijo desde `lg`; por debajo, un drawer. §7: en móvil los paneles van a
 * hoja, no a menú comprimido. `vaul` da el arrastre para cerrar que se siente
 * nativo en iOS, que es donde James lo usa.
 *
 * El sidebar es `chrome`, MÁS CLARO que el `content` de la derecha: así se
 * separa del contenido sin necesitar una línea, que es el truco que sostiene
 * la paleta entera.
 */
export function Navegacion() {
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);

  // `useCallback`: el hook engancha un listener global y sin esto lo
  // desengancharía y reengancharía en cada render del layout.
  const abrirBuscador = useCallback(() => setBuscando(true), []);
  useAtajoBuscador(abrirBuscador);

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
              <BotonBuscar
                alAbrir={() => {
                  // Primero cerrar el drawer: dos capas modales a la vez dejan
                  // el foco en la de abajo y el teclado del iPhone escribiendo
                  // donde no se ve.
                  setAbierto(false);
                  setBuscando(true);
                }}
              />
              <div className="px-2.5">
                <Enlaces alNavegar={() => setAbierto(false)} />
              </div>
              <div className="mt-auto">
                <PiePerfil />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
        <Marca />
        <button
          type="button"
          aria-label="Buscar"
          onClick={abrirBuscador}
          className="text-ash hover:bg-card-hover hover:text-bone ml-auto flex size-11 items-center justify-center rounded-md transition-colors duration-150"
        >
          <Search className="size-[18px]" aria-hidden />
        </button>
      </header>

      {/* `sticky` con `h-dvh`, no `fixed`: pegado a la ventana **y ocupando su
          hueco** en el flujo. Con `fixed` habría que compensar el ancho a mano
          en el contenido, y es el mismo fallo que ya costó la barra de subidas.
          Sin esto, el `aside` crecía con la página y «Cerrar sesión» quedaba al
          fondo de doce galerías: para salir había que scrollear hasta abajo. */}
      <aside className="border-line bg-chrome hidden w-58 shrink-0 flex-col border-r lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="entra px-2.5 pt-5 pb-5">
          <Marca />
        </div>
        <BotonBuscar alAbrir={abrirBuscador} />
        {/* Scroll propio: con el sidebar a la altura de la ventana, un menú que
            no quepa dejaría el pie fuera de alcance en vez de empujar la página. */}
        <div className="sin-barra min-h-0 flex-1 overflow-y-auto px-2.5">
          <Enlaces />
        </div>
        <div className="shrink-0">
          <PiePerfil />
        </div>
      </aside>

      <BuscadorGlobal abierto={buscando} alCerrar={() => setBuscando(false)} />
    </>
  );
}
