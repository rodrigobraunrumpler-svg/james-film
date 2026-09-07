'use client';

import type { AdminCategoryDto } from '@james-film/contracts';
import { cn } from '@/lib/utils/cn';

/**
 * El orden es abstracto hasta que se ve DÓNDE acaba. Esta tira es la misma
 * lista de abajo pintada como sale en el menú de la web: mover una tarjeta y
 * verlo aquí al momento es lo que convierte «orden 3» en una decisión.
 *
 * Las ocultas salen tachadas en vez de desaparecer: si desaparecieran, ocultar
 * una parecería haberla borrado.
 */
export function TiraMenu({ categorias }: { categorias: AdminCategoryDto[] }) {
  if (categorias.length === 0) return null;

  return (
    <section
      aria-label="Menú de la web"
      className="entra border-line bg-chrome rounded-card flex flex-wrap items-center gap-x-3.5 gap-y-2 border px-3.5 py-2.5"
      style={{ '--i': 1 } as React.CSSProperties}
    >
      <span className="text-muted text-xs tracking-[0.1em] uppercase">Así sale el menú</span>

      <ul className="flex min-w-0 flex-wrap gap-1">
        {categorias.map((c) => (
          <li
            key={c.id}
            className={cn(
              'rounded-[5px] px-3 py-1 text-sm transition-colors duration-200',
              c.isActive ? 'bg-active' : 'text-muted line-through',
            )}
          >
            {c.name}
          </li>
        ))}
      </ul>

      <span className="text-muted ml-auto text-xs">
        <span className="lg:hidden">Muévelas con las flechas</span>
        <span className="hidden lg:inline">Arrástralas o usa las flechas</span>
      </span>
    </section>
  );
}
