import type { GalleryListItemDto } from '@james-film/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { fecha } from '@/lib/format';

/**
 * Una fila que en móvil es una tarjeta apilada. §7: nada de scroll horizontal
 * dentro de una página que ya scrollea vertical.
 */
export function FilaGaleria({ galeria }: { galeria: GalleryListItemDto }) {
  return (
    <li>
      <Link
        href={`/galerias/${galeria.id}`}
        className="flex min-h-16 items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-neutral-50"
      >
        <div className="relative aspect-[9/16] w-12 shrink-0 overflow-hidden rounded bg-neutral-100">
          {galeria.coverUrl && (
            <Image
              src={galeria.coverUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              unoptimized
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* break-words: un título de 60 caracteres no debe romper la tarjeta (§7). */}
          <span className="truncate font-medium">{galeria.title}</span>
          <span className="truncate text-sm text-neutral-600">
            {galeria.category.name}
            {galeria.eventDate ? ` · ${fecha(galeria.eventDate)}` : ''}
          </span>
        </div>

        <span className="shrink-0 text-sm text-neutral-500">
          {galeria.mediaCount} {galeria.mediaCount === 1 ? 'medio' : 'medios'}
        </span>
      </Link>
    </li>
  );
}
