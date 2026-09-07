'use client';

import * as Popover from '@radix-ui/react-popover';
import type { AdminCategoryDto } from '@james-film/contracts';
import { ArrowDown, ArrowUp, EyeOff, GripVertical, MoreHorizontal } from 'lucide-react';
import { Boton, clasesBoton } from '@/components/shared/boton';
import { VerEnLaWeb } from '@/components/shared/ver-en-la-web';
import { degradadoDe } from '@/lib/degradado';
import { urlCategoria } from '@/lib/enlaces';
import { ocultarSiFalla } from '@/lib/imagen';
import { Pista } from '@/components/shared/pista';
import { cn } from '@/lib/utils/cn';

/**
 * Los mismos tres colores que el reparto del panel, en el mismo orden: latón al
 * que más tira y grises al resto. Que la misma barra signifique lo mismo en dos
 * pantallas es lo que hace que no haya que aprender nada nuevo aquí.
 */
// Del latón de relleno, no de un hex a mano: sobre blanco, el #9A7F47 que
// había escrito queda apagado, y el punto de estos tres tramos es que se
// distingan. `brass` es el fuerte, `brass-relleno` el medio, `sutil` el flojo.
const TRAMOS = ['bg-brass', 'bg-brass-relleno', 'bg-sutil'] as const;

/**
 * Una categoría NO es un nombre y un slug: es un montón de vídeos. La tarjeta
 * enseña qué hay dentro —portada, tres galerías recientes— y a qué paquete van
 * sus clics, que es la única razón por la que una categoría importa al negocio.
 *
 * El degradado va DEBAJO de la portada, como en la lista de galerías: se ve
 * mientras la imagen carga y es lo único que hay cuando aún no tiene ninguna.
 */
export function TarjetaCategoria({
  categoria: c,
  indice,
  total,
  alMover,
  alEditar,
  alAlternarVisible,
  alPedirBorrado,
  i,
}: {
  categoria: AdminCategoryDto;
  indice: number;
  total: number;
  alMover: (desde: number, hasta: number) => void;
  alEditar: () => void;
  alAlternarVisible: () => void;
  alPedirBorrado: () => void;
  /** Posición en la entrada escalonada. */
  i: number;
}) {
  const mezcla = c.clickMix.slice(0, TRAMOS.length);
  const lider = mezcla[0];
  // Con más de tres paquetes los tramos no sumaban 100% y quedaba un hueco a la
  // derecha que se leía como un fallo de render.
  const resto = c.clickTotal - mezcla.reduce((suma, m) => suma + m.count, 0);

  return (
    <article
      className={cn(
        'entra levanta bg-card border-line rounded-card elevada flex flex-col overflow-hidden border',
        // Arrastre nativo, solo escritorio — el mismo patrón que las teselas
        // del editor. En táctil no hace nada a propósito: ahí se usan las
        // flechas, que son el mismo camino de código.
        'lg:cursor-grab',
        !c.isActive && 'opacity-55',
      )}
      style={{ '--i': i } as React.CSSProperties}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(indice))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const desde = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isInteger(desde) && desde !== indice) alMover(desde, indice);
      }}
    >
      <div
        className="degradado relative aspect-video shrink-0 overflow-hidden"
        style={degradadoDe(c.id)}
      >
        {c.coverUrl && (
          <img
            src={c.coverUrl}
            alt=""
            loading="lazy"
            onError={ocultarSiFalla}
            // Absoluta a propósito: en el flujo, `h-full` no resuelve dentro de
            // una caja con `aspect-ratio` y el alto intrínseco de un póster 9:16
            // estiraba la tarjeta hasta descuadrar la rejilla.
            className="absolute inset-0 size-full object-cover object-[center_35%]"
          />
        )}

        {/* El asa se ve SIEMPRE, no al pasar por encima: en el iPhone de James
            no hay hover, así que ahí no saldría nunca. */}
        <span className="border-line-strong absolute top-2 left-2 [background:var(--color-velo)] flex h-6 items-center gap-1 rounded-[5px] border px-1.5 backdrop-blur-[6px]">
          <GripVertical className="text-ash size-3" aria-hidden />
          <span className="text-xs tabular-nums">{indice + 1}</span>
        </span>

        {!c.isActive && (
          <span className="border-line-strong text-ash absolute top-2 right-2 [background:var(--color-velo)] flex h-6 items-center gap-1.5 rounded-[5px] border px-2 text-xs backdrop-blur-[6px]">
            <EyeOff className="size-3" aria-hidden />
            Oculta
          </span>
        )}

        <Recientes urls={c.recentCoverUrls} />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display min-w-0 truncate text-[16px] font-extrabold tracking-[-0.02em]">
            {c.name}
          </h3>
          <span className="text-muted shrink-0 text-xs">/{c.slug}</span>
        </div>

        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="border-line text-ash rounded border px-1.5 py-0.5">
            {c.galleryCount} {c.galleryCount === 1 ? 'galería' : 'galerías'}
          </span>
          <span className="border-line text-ash rounded border px-1.5 py-0.5">
            {c.packageCount} {c.packageCount === 1 ? 'paq.' : 'paqs.'}
          </span>
        </p>

        <div className="mt-auto">
          {lider ? (
            <>
              <div className="mb-2 flex h-[5px] gap-0.5 overflow-hidden rounded-full">
                {mezcla.map((p, n) => (
                  <span
                    key={p.packageId}
                    className={cn('barra-crece origin-left', TRAMOS[n])}
                    style={
                      {
                        width: `${(p.count / c.clickTotal) * 100}%`,
                        '--i': i + n,
                      } as React.CSSProperties
                    }
                  />
                ))}
                {resto > 0 && (
                  <span
                    className="bg-line barra-crece origin-left"
                    style={
                      {
                        width: `${(resto / c.clickTotal) * 100}%`,
                        '--i': i + mezcla.length,
                      } as React.CSSProperties
                    }
                  />
                )}
              </div>
              <p className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted">Sus clics van al</span>
                <span className="text-brass font-medium">{lider.packageName}</span>
              </p>
            </>
          ) : (
            // Cero clics es un estado legítimo, no un fallo: la landing aún no
            // existe. Se dice, en vez de dejar el hueco y que parezca que falta.
            <p className="text-muted text-xs">Sin clics todavía</p>
          )}
        </div>

        <div className="border-line flex gap-1.5 border-t pt-2.5">
          <Boton className="flex-1" onClick={alEditar}>
            Editar
          </Boton>
          {/* El ojo del prototipo: comprobar cómo ha quedado en la web es la
              otra mitad de editarla. Solo si está visible — un enlace a una
              sección que la web no pinta lleva a un 404. */}
          {c.isActive && (
            <VerEnLaWeb soloIcono url={urlCategoria(c.slug)} etiqueta={`Ver ${c.name} en la web`} />
          )}
          <Pista texto={`Mover ${c.name} antes`} lado="arriba">
            <button
              type="button"
              aria-label={`Mover ${c.name} antes`}
              disabled={indice === 0}
              onClick={() => alMover(indice, indice - 1)}
              className={clasesBoton('secundario', 'w-11 px-0 lg:w-[30px]')}
            >
              <ArrowUp className="size-3.5" aria-hidden />
            </button>
          </Pista>
          <Pista texto={`Mover ${c.name} después`} lado="arriba">
            <button
              type="button"
              aria-label={`Mover ${c.name} después`}
              disabled={indice >= total - 1}
              onClick={() => alMover(indice, indice + 1)}
              className={clasesBoton('secundario', 'w-11 px-0 lg:w-[30px]')}
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </button>
          </Pista>
          <MenuMas
            nombre={c.name}
            activa={c.isActive}
            alAlternarVisible={alAlternarVisible}
            alPedirBorrado={alPedirBorrado}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * Las tres galerías más recientes, en 9:16 —que es el formato real del trabajo
 * de James—. Sin ninguna no se pinta nada: tres huecos vacíos se leen como un
 * fallo de carga, no como una categoría nueva.
 */
function Recientes({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  return (
    <div className="absolute bottom-2.5 left-2.5 flex" aria-hidden>
      {urls.slice(0, 3).map((url, i) => (
        <span
          key={url}
          className="border-line-strong aspect-[9/16] w-[26px] overflow-hidden rounded-[3px] border first:ml-0 [&:not(:first-child)]:-ml-2.25"
          // Solapadas como un mazo, y cada una un poco más apagada: dicen «hay
          // más detrás» sin necesitar un «+ N» que compita con el nombre. En
          // fila y separadas dirían «hay exactamente tres», que es otra cosa.
          style={{ opacity: 1 - i * 0.18, zIndex: 3 - i }}
        >
          <img
            src={url}
            alt=""
            loading="lazy"
            onError={ocultarSiFalla}
            className="size-full object-cover"
          />
        </span>
      ))}
    </div>
  );
}

/**
 * Ocultar y Borrar en un menú y no dos botones más en la fila: con cinco
 * objetivos de 44px no cabe en 320px, y §7 no admite scroll horizontal.
 *
 * Con el Popover de Radix, que ya está en el proyecto —lo usan el selector de
 * ícono y el de fecha—. **`<details>` NO vale aquí**: no se cierra al pulsar
 * fuera, así que abrir uno y tocar en otro sitio lo deja abierto tapando la
 * tarjeta de al lado. Radix cierra al pulsar fuera, con Escape, devuelve el
 * foco al disparador y **no renderiza el contenido mientras está cerrado**.
 */
function MenuMas({
  nombre,
  activa,
  alAlternarVisible,
  alPedirBorrado,
}: {
  nombre: string;
  activa: boolean;
  alAlternarVisible: () => void;
  alPedirBorrado: () => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Más acciones para ${nombre}`}
        className={clasesBoton('secundario', 'w-11 px-0 lg:w-[30px]')}
      >
        <MoreHorizontal className="size-3.5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="border-line-strong bg-chrome rounded-control z-50 flex w-44 flex-col border p-1 shadow-[var(--sombra-flotante)] data-[state=open]:animate-[sube_0.15s_cubic-bezier(0.2,0.8,0.2,1)_both]"
        >
          <button
            type="button"
            onClick={alAlternarVisible}
            className="text-ash hover:bg-card-hover hover:text-bone rounded-control flex min-h-11 items-center px-2.5 text-left text-sm transition-colors duration-150 lg:min-h-8"
          >
            {activa ? 'Ocultar de la web' : 'Mostrar en la web'}
          </button>
          <button
            type="button"
            onClick={alPedirBorrado}
            className="text-danger hover:bg-danger-bg rounded-control flex min-h-11 items-center px-2.5 text-left text-sm transition-colors duration-150 lg:min-h-8"
          >
            Borrar
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
