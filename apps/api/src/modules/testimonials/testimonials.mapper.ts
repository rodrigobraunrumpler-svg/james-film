import type { AdminTestimonialDto, TestimonialDto } from '@james-film/contracts';
import type { StorageService } from '../../storage/storage.service.js';

export const SELECT_TESTIMONIO = {
  id: true,
  format: true,
  source: true,
  authorName: true,
  authorHandle: true,
  avatarKey: true,
  eventType: true,
  eventDate: true,
  quote: true,
  screenshotKey: true,
  externalUrl: true,
  rating: true,
  galleryId: true,
} as const;

export const SELECT_TESTIMONIO_ADMIN = {
  ...SELECT_TESTIMONIO,
  hasConsent: true,
  isActive: true,
  isFeatured: true,
  order: true,
} as const;

interface FilaTestimonio {
  id: string;
  format: TestimonialDto['format'];
  source: TestimonialDto['source'];
  authorName: string;
  authorHandle: string | null;
  avatarKey: string | null;
  eventType: string | null;
  eventDate: Date | null;
  quote: string | null;
  screenshotKey: string | null;
  externalUrl: string | null;
  rating: number | null;
  galleryId: string | null;
}

interface FilaTestimonioAdmin extends FilaTestimonio {
  hasConsent: boolean;
  isActive: boolean;
  isFeatured: boolean;
  order: number;
}

/** `@db.Date` a `YYYY-MM-DD`: es una fecha de calendario, no un instante. */
const aFecha = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export function mapTestimonio(t: FilaTestimonio, storage: StorageService): TestimonialDto {
  return {
    id: t.id,
    format: t.format,
    source: t.source,
    authorName: t.authorName,
    authorHandle: t.authorHandle,
    avatarUrl: t.avatarKey ? storage.getPublicUrl(t.avatarKey) : null,
    eventType: t.eventType,
    eventDate: aFecha(t.eventDate),
    quote: t.quote,
    screenshotUrl: t.screenshotKey ? storage.getPublicUrl(t.screenshotKey) : null,
    externalUrl: t.externalUrl,
    rating: t.rating,
    galleryId: t.galleryId,
  };
}

export function mapTestimonioAdmin(
  t: FilaTestimonioAdmin,
  storage: StorageService,
): AdminTestimonialDto {
  return {
    ...mapTestimonio(t, storage),
    hasConsent: t.hasConsent,
    isActive: t.isActive,
    isFeatured: t.isFeatured,
    order: t.order,
  };
}
