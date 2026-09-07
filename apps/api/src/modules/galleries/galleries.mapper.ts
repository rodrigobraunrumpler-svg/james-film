import type {
  AdminGalleryDto,
  AdminGalleryListItemDto,
  AdminMediaDto,
  GalleryDto,
  GalleryListItemDto,
  MediaDto,
  MediaStatus,
} from '@james-film/contracts';
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

/** El admin ve además el estado: sin él no puede pintar la tarjeta rota tras recargar. */
export const SELECT_MEDIA_ADMIN = { ...SELECT_MEDIA, status: true, error: true } as const;

export const SELECT_CATEGORIA = { id: true, slug: true, name: true } as const;

export const SELECT_GALERIA = {
  id: true,
  slug: true,
  title: true,
  description: true,
  eventDate: true,
  location: true,
  isFeatured: true,
  isPublished: true,
  hasConsent: true,
  category: { select: SELECT_CATEGORIA },
} as const;

/**
 * `updatedAt` va SOLO en el select del admin. En la lista pública no se usa y
 * no tiene por qué viajar: lo que no se selecciona no se puede filtrar mal.
 */
export const SELECT_GALERIA_ADMIN = { ...SELECT_GALERIA, updatedAt: true } as const;

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
  isFeatured: boolean;
  isPublished: boolean;
  hasConsent: boolean;
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

/**
 * La portada se DERIVA, siempre. `Gallery.coverKey` existía como override manual
 * y **no la escribía nadie**: ningún DTO la exponía y el mapper solo la leía, así
 * que era una columna muerta con lectura viva — justo lo que alguien «arregla»
 * cableándola sin saber que derivarla es deliberado. Borrada en la fase 4,
 * verificada vacía antes. Escribir una clave metería un `.mp4` en el
 * campo de portada cuando el vídeo no tiene poster —y `confirmar` anula el posterKey
 * justo cuando el poster falla—, además de duplicar estado que se puede calcular.
 */
/**
 * La regla de la portada, en UN solo sitio: el panel y las categorías la
 * necesitan igual, y duplicarla es cómo acaba el `storageKey` de un vídeo
 * dentro de un `<img>`.
 */
export function claveDePortada(
  media: {
    isFeatured: boolean;
    posterKey: string | null;
    storageKey: string;
    type: MediaDto['type'];
  }[],
): string | null {
  const portada = media.find((m) => m.isFeatured);
  if (!portada) return null;
  // Nunca el storageKey de un vídeo: sería un .mp4 dentro de un <img>.
  return portada.posterKey ?? (portada.type === 'PHOTO' ? portada.storageKey : null);
}

export function mapMediaAdmin(
  m: FilaMedia & { status: MediaStatus; error: string | null },
  storage: StorageService,
): AdminMediaDto {
  return { ...mapMedia(m, storage), status: m.status, error: m.error };
}

export function mapGaleriaAdmin(
  g: FilaGaleria & { media: (FilaMedia & { status: MediaStatus; error: string | null })[] },
  storage: StorageService,
): AdminGalleryDto {
  const clave = claveDePortada(g.media);
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    description: g.description,
    eventDate: aFecha(g.eventDate),
    location: g.location,
    coverUrl: clave ? storage.getPublicUrl(clave) : null,
    isFeatured: g.isFeatured,
    isPublished: g.isPublished,
    hasConsent: g.hasConsent,
    category: g.category,
    media: g.media.map((m) => mapMediaAdmin(m, storage)),
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
    coverUrl: (() => {
      const clave = claveDePortada(g.media);
      return clave ? storage.getPublicUrl(clave) : null;
    })(),
    isFeatured: g.isFeatured,
    category: g.category,
    media: g.media.map((m) => mapMedia(m, storage)),
  };
}

export function mapGaleriaListaAdmin(
  g: FilaGaleria & { updatedAt: Date; _count: { media: number }; media: FilaMedia[] },
  storage: StorageService,
  fotos: number,
): AdminGalleryListItemDto {
  // El medio destacado ya viene en `media` (take: 1): de ahí salen el icono de
  // reproducir y el `1:12` de la tarjeta, sin una segunda consulta.
  const portada = g.media.find((m) => m.isFeatured) ?? null;
  return {
    ...mapGaleriaLista(g, storage, fotos),
    isPublished: g.isPublished,
    hasConsent: g.hasConsent,
    updatedAt: g.updatedAt.toISOString(),
    coverType: portada?.type ?? null,
    coverDurationSec: portada?.durationSec ?? null,
  };
}

export function mapGaleriaLista(
  g: FilaGaleria & { _count: { media: number }; media: FilaMedia[] },
  storage: StorageService,
  /** Cuántas de las visibles son fotos. Lo cuenta el servicio: ver `fotosPorGaleria`. */
  fotos: number,
): GalleryListItemDto {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    eventDate: aFecha(g.eventDate),
    location: g.location,
    coverUrl: (() => {
      const clave = claveDePortada(g.media);
      return clave ? storage.getPublicUrl(clave) : null;
    })(),
    isFeatured: g.isFeatured,
    category: g.category,
    mediaCount: g._count.media,
    photoCount: fotos,
  };
}
