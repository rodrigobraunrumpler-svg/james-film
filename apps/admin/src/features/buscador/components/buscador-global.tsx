'use client';

import type { SearchKind, SearchResultDto } from '@james-film/contracts';
import { Images, Layers, MessageSquareQuote, Package, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { degradadoDe } from '@/lib/degradado';
import { ocultarSiFalla } from '@/lib/imagen';
import { cn } from '@/lib/utils/cn';
import { useBusqueda } from '../hooks/use-buscador';

/**
 * Las pantallas y las acciones viven en el CLIENTE: son rutas fijas, y meterlas
 * en la API sería una petición por tecla para buscar en una lista de catorce
 * cadenas que no cambian nunca.
 *
 * `busca` es lo que además de la etiqueta hace que casen: escribir «ajustes»
 * tiene que encontrar Configuración, y «wasap» el número de WhatsApp. Sin eso,
 * el atajo solo sirve si ya sabes cómo se llama la pantalla — que es justo lo
 * que no pasa cuando te pierdes.
 */
const IR_A = [
  { id: 'ir:galerias', label: 'Galerías', href: '/', busca: 'galerias eventos bodas reels' },
  { id: 'ir:panel', label: 'Panel', href: '/panel', busca: 'panel inicio resumen clics' },
  { id: 'ir:categorias', label: 'Categorías', href: '/categorias', busca: 'categorias secciones' },
  { id: 'ir:paquetes', label: 'Paquetes', href: '/paquetes', busca: 'paquetes precios planes' },
  {
    id: 'ir:testimonios',
    label: 'Testimonios',
    href: '/testimonios',
    busca: 'testimonios reseñas',
  },
  {
    id: 'ir:disponibilidad',
    label: 'Disponibilidad',
    href: '/disponibilidad',
    // «fechas», «calendario» y «libre» son como lo llama él; «ocupado» y
    // «reserva», como lo llama el cliente. Los dos tienen que encontrarlo.
    busca: 'disponibilidad calendario fechas libres ocupado reserva agenda dias',
  },
  {
    id: 'ir:contacto',
    label: 'Configuración › Contacto',
    href: '/configuracion?pestana=contacto',
    busca: 'configuracion ajustes contacto whatsapp numero redes',
  },
  {
    id: 'ir:hero',
    label: 'Configuración › Hero',
    href: '/configuracion?pestana=hero',
    busca: 'configuracion ajustes hero video portada',
  },
  {
    id: 'ir:seo',
    label: 'Configuración › SEO',
    href: '/configuracion?pestana=seo',
    busca: 'configuracion ajustes seo google meta compartir',
  },
] as const;

const HACER = [
  {
    id: 'do:nueva',
    label: 'Nueva galería',
    href: '/?nueva=1',
    busca: 'nueva galeria crear evento',
  },
  {
    id: 'do:categoria',
    label: 'Nueva categoría',
    href: '/categorias',
    busca: 'nueva categoria crear seccion',
  },
  {
    id: 'do:paquete',
    label: 'Nuevo paquete',
    href: '/paquetes',
    busca: 'nuevo paquete crear precio',
  },
] as const;

/**
 * Sin acentos y en minúsculas: James escribe «bodas» y «xv anos» sin pensar en
 * la tilde, y un atajo que no encuentra «configuracion» porque falta la ó no
 * sirve para nada.
 */
const plano = (v: string): string =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const ICONO: Record<SearchKind, typeof Images> = {
  GALLERY: Images,
  PACKAGE: Package,
  CATEGORY: Layers,
  TESTIMONIAL: MessageSquareQuote,
};

const GRUPO: Record<SearchKind, string> = {
  GALLERY: 'Galerías',
  PACKAGE: 'Paquetes',
  CATEGORY: 'Categorías',
  TESTIMONIAL: 'Testimonios',
};

interface Fila {
  clave: string;
  label: string;
  hint: string | null;
  href: string;
  kind: SearchKind | null;
  coverUrl: string | null;
  /** El grupo bajo el que se pinta. */
  grupo: string;
  /** El id de la galería, para caer a su degradado si no hay portada. */
  galleryId: string | null;
}

/**
 * El buscador global. `<dialog>` NATIVO y no una librería de modal: el
 * navegador ya trae foco atrapado, cierre con Escape, `::backdrop` y el
 * apilado por encima de todo. Es exactamente lo que hace falta y son cero
 * kilobytes de dependencia.
 *
 * Es lo que ata las ocho pantallas: desde cualquier sitio se llega a cualquier
 * sitio sin volver atrás.
 */
export function BuscadorGlobal({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [termino, setTermino] = useState('');
  const [indice, setIndice] = useState(0);
  const idLista = useId();

  const { resultados, cargando, corta } = useBusqueda(termino);
  const filas = aFilas(termino, resultados);

  // `showModal()` y no el atributo `open`: solo la llamada activa el foco
  // atrapado y el `::backdrop`. Con `open` el diálogo se pinta pero el tabulador
  // sigue paseándose por el panel de detrás.
  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) {
      el.showModal();
      setTermino('');
      setIndice(0);
    }
    if (!abierto && el.open) el.close();
  }, [abierto]);

  // El índice se recorta al cambiar los resultados: si no, tras escribir una
  // letra más el resaltado apunta a una fila que ya no existe y Enter no hace nada.
  useEffect(() => {
    setIndice((i) => (i >= filas.length ? 0 : i));
  }, [filas.length]);

  const ir = (href: string): void => {
    alCerrar();
    router.push(href);
  };

  return (
    <dialog
      ref={dialogo}
      aria-label="Buscar"
      // `close` cubre las dos salidas que NO pasan por nuestro código: Escape y
      // el gesto de retroceso. Sin esto el estado seguiría diciendo «abierto» y
      // ⌘K no volvería a abrirlo.
      onClose={alCerrar}
      onClick={(e) => {
        // El backdrop es parte del propio <dialog>: un clic en él tiene al
        // diálogo como `target`, y el contenido está en el <div> de dentro.
        if (e.target === dialogo.current) alCerrar();
      }}
      onKeyDown={(e) => {
        if (filas.length === 0) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setIndice((i) => (i + 1) % filas.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setIndice((i) => (i - 1 + filas.length) % filas.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const fila = filas[indice];
          if (fila) ir(fila.href);
        }
      }}
      className={cn(
        'bg-chrome border-line-strong rounded-card m-0 w-[calc(100dvw-2rem)] max-w-[520px] overflow-hidden border p-0',
        'text-bone fixed top-[12dvh] left-1/2 -translate-x-1/2 shadow-[var(--sombra-flotante)]',
        'backdrop:bg-well/62 open:entra',
      )}
    >
      <div className="border-line flex h-[46px] items-center gap-2.5 border-b px-4">
        <Search className="text-muted size-[15px] shrink-0" aria-hidden />
        <input
          autoFocus
          value={termino}
          onChange={(e) => {
            setTermino(e.target.value);
            setIndice(0);
          }}
          placeholder="Buscar o ir a…"
          aria-label="Buscar"
          aria-controls={idLista}
          className="placeholder:text-muted min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
        {cargando && <span className="text-muted text-xs">…</span>}
        <kbd className="border-line-strong text-muted rounded border px-1.5 py-px text-[10px]">
          esc
        </kbd>
      </div>

      <div id={idLista} role="listbox" className="max-h-[400px] overflow-y-auto pb-1.5">
        {filas.length === 0 ? (
          <p className="text-muted px-4 py-6 text-center text-sm">
            {corta ? 'Escribe al menos dos letras' : `Nada que case con «${termino.trim()}»`}
          </p>
        ) : (
          agrupar(filas).map(([grupo, delGrupo]) => (
            <div key={grupo}>
              <p className="text-muted px-4 pt-2.5 pb-1 text-xs tracking-[0.1em] uppercase">
                {grupo}
              </p>
              {delGrupo.map((fila) => {
                const i = filas.indexOf(fila);
                const activo = i === indice;
                const Icono = fila.kind ? ICONO[fila.kind] : Search;
                return (
                  <button
                    key={fila.clave}
                    type="button"
                    role="option"
                    aria-selected={activo}
                    // `mouseMove` y no `mouseEnter`: al abrir con teclado el
                    // puntero ya puede estar encima de una fila, y `enter` no
                    // dispara — el resaltado saltaría solo al mover el ratón.
                    onMouseMove={() => setIndice(i)}
                    onClick={() => ir(fila.href)}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2.5 px-4 text-left lg:min-h-9',
                      activo
                        ? 'bg-active text-bone shadow-[inset_2px_0_0_var(--color-brass)]'
                        : 'text-ash',
                    )}
                  >
                    {/* Una galería siempre lleva tesela: con portada o con su
                        degradado, el mismo que la lista y el panel. Un icono
                        genérico ahí no distingue una boda de otra. */}
                    {fila.galleryId ? (
                      <span
                        aria-hidden
                        className="degradado aspect-[9/16] w-[15px] shrink-0 overflow-hidden rounded-[2px]"
                        style={degradadoDe(fila.galleryId)}
                      >
                        {fila.coverUrl && (
                          <img
                            src={fila.coverUrl}
                            alt=""
                            onError={ocultarSiFalla}
                            className="size-full object-cover"
                          />
                        )}
                      </span>
                    ) : (
                      <Icono
                        className={cn('size-[15px] shrink-0', activo ? 'text-brass' : 'text-muted')}
                        aria-hidden
                      />
                    )}
                    <span className="dato min-w-0 flex-1 truncate">{fila.label}</span>
                    {fila.hint && <span className="text-muted shrink-0 text-xs">{fila.hint}</span>}
                    {activo && !fila.hint && <span className="text-muted text-xs">↵</span>}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="border-line bg-content text-muted flex h-[34px] items-center gap-3.5 border-t px-4 text-xs">
        <span>↑↓ moverse</span>
        <span>↵ abrir</span>
        <span className="ml-auto hidden sm:inline">Busca galerías, paquetes y pantallas</span>
      </div>
    </dialog>
  );
}

/**
 * Las tres fuentes en UN array plano: pantallas, acciones y lo que devuelve la
 * API. El índice del teclado se mueve sobre esta lista, así que derivar los
 * grupos aparte los desincronizaría — por eso el grupo viaja en cada fila.
 *
 * Con UNA letra se devuelve vacío: has escrito algo y ver tres cosas que no
 * tienen nada que ver con ello es ruido. El pie dice que sigas escribiendo.
 */
function aFilas(termino: string, resultados: SearchResultDto[]): Fila[] {
  const limpio = plano(termino.trim());
  if (limpio.length > 0 && limpio.length < 2) return [];

  const fijas = (lista: typeof IR_A | typeof HACER, grupo: string): Fila[] =>
    lista
      .filter((a) => limpio.length === 0 || plano(`${a.label} ${a.busca}`).includes(limpio))
      .map((a) => ({
        clave: a.id,
        label: a.label,
        hint: null,
        href: a.href,
        kind: null,
        coverUrl: null,
        galleryId: null,
        grupo,
      }));

  // Sin término, «Ir a» recortado: la caja recién abierta tiene que caber de un
  // vistazo, no obligar a scrollear antes de haber escrito nada.
  if (limpio.length === 0) {
    return [...fijas(IR_A, 'Ir a').slice(0, 3), ...fijas(HACER, 'Hacer')];
  }

  return [
    ...fijas(IR_A, 'Ir a'),
    ...resultados.map((r) => ({
      clave: `${r.kind}:${r.id}`,
      label: r.label,
      hint: r.hint,
      href: r.href,
      kind: r.kind,
      coverUrl: r.coverUrl,
      galleryId: r.kind === 'GALLERY' ? r.id : null,
      grupo: GRUPO[r.kind],
    })),
    ...fijas(HACER, 'Hacer'),
  ];
}

function agrupar(filas: Fila[]): [string, Fila[]][] {
  const grupos = new Map<string, Fila[]>();
  for (const f of filas) {
    grupos.set(f.grupo, [...(grupos.get(f.grupo) ?? []), f]);
  }
  return [...grupos];
}
