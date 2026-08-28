import type { GalleryDto, GalleryListItemDto, MediaDto } from '@james-film/contracts';
import type { StorageService } from '../../storage/storage.service.js';

/**
 * `select` explícitos. Son la frontera real: lo que no está aquí NUNCA sale de
 * la base, y como el mapper devuelve el DTO anotado, olvidarse de un campo no
 * compila. Con `@Exclude()` sería al revés: olvidarlo lo publicaría.
 */
export const SELECT_MEDIA = {
  id: true,
  type: true,
  orientation: true,
  storageKey: true,
  posterKey: true,
  width: true,
  height: true,
  durationSec: true,
  alt: true,
  caption: true,
  order: true,
  isFeatured: true,
} as const;

export const SELECT_CATEGORIA = { id: true, slug: true, name: true } as const;

export const SELECT_GALERIA = {
  id: true,
  slug: true,
  title: true,
  description: true,
  eventDate: true,
  location: true,
  coverKey: true,
  isFeatured: true,
  category: { select: SELECT_CATEGORIA },
} as const;

type FilaMedia = { [K in keyof typeof SELECT_MEDIA]: unknown } & {
  id: string;
  type: MediaDto['type'];
  orientation: MediaDto['orientation'];
  storageKey: string;
  posterKey: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  alt: string | null;
  caption: string | null;
  order: number;
  isFeatured: boolean;
};

interface FilaCategoria {
  id: string;
  slug: string;
  name: string;
}

interface FilaGaleria {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  eventDate: Date | null;
  location: string | null;
  coverKey: string | null;
  isFeatured: boolean;
  category: FilaCategoria;
}

/**
 * `@db.Date` vuelve como Date a medianoche UTC. Se recorta a `YYYY-MM-DD`
 * porque es una fecha de calendario, no un instante: formatearla en Lima
 * restaría 5 horas y mostraría el día anterior.
 */
const aFecha = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export function mapMedia(m: FilaMedia, storage: StorageService): MediaDto {
  return {
    id: m.id,
    type: m.type,
    orientation: m.orientation,
    url: storage.getPublicUrl(m.storageKey),
    posterUrl: m.posterKey ? storage.getPublicUrl(m.posterKey) : null,
    width: m.width,
    height: m.height,
    durationSec: m.durationSec,
    alt: m.alt,
    caption: m.caption,
    order: m.order,
    isFeatured: m.isFeatured,
  };
}

export function mapGaleria(
  g: FilaGaleria & { media: FilaMedia[] },
  storage: StorageService,
): GalleryDto {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    description: g.description,
    eventDate: aFecha(g.eventDate),
    location: g.location,
    coverUrl: g.coverKey ? storage.getPublicUrl(g.coverKey) : null,
    isFeatured: g.isFeatured,
    category: g.category,
    media: g.media.map((m) => mapMedia(m, storage)),
  };
}

export function mapGaleriaLista(
  g: FilaGaleria & { _count: { media: number } },
  storage: StorageService,
): GalleryListItemDto {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    eventDate: aFecha(g.eventDate),
    location: g.location,
    coverUrl: g.coverKey ? storage.getPublicUrl(g.coverKey) : null,
    isFeatured: g.isFeatured,
    category: g.category,
    mediaCount: g._count.media,
  };
}
