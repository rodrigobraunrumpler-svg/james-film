import type { AdminPackageDto, PackageDto } from '@james-film/contracts';
import type { StorageService } from '../../storage/storage.service.js';

export const SELECT_ITEM = { id: true, text: true, included: true, order: true } as const;

export const SELECT_PAQUETE = {
  id: true,
  slug: true,
  name: true,
  subtitle: true,
  priceAmount: true,
  currency: true,
  priceNote: true,
  idealFor: true,
  icon: true,
  imageKey: true,
  badgeText: true,
  whatsappMessage: true,
  isHighlighted: true,
} as const;

export const SELECT_PAQUETE_ADMIN = {
  ...SELECT_PAQUETE,
  isActive: true,
  order: true,
  accentColor: true,
} as const;

interface FilaItem {
  id: string;
  text: string;
  included: boolean;
  order: number;
}

interface FilaPaquete {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  priceAmount: number | null;
  currency: string;
  priceNote: string | null;
  idealFor: string | null;
  icon: string | null;
  imageKey: string | null;
  badgeText: string | null;
  whatsappMessage: string | null;
  isHighlighted: boolean;
  items: FilaItem[];
}

interface FilaPaqueteAdmin extends FilaPaquete {
  isActive: boolean;
  order: number;
  accentColor: string | null;
  categories: { categoryId: string }[];
  _count: { whatsappClicks: number };
}

export function mapPaquete(p: FilaPaquete, storage: StorageService): PackageDto {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    priceAmount: p.priceAmount,
    currency: p.currency,
    priceNote: p.priceNote,
    idealFor: p.idealFor,
    icon: p.icon,
    imageUrl: p.imageKey ? storage.getPublicUrl(p.imageKey) : null,
    badgeText: p.badgeText,
    whatsappMessage: p.whatsappMessage,
    isHighlighted: p.isHighlighted,
    // El público no ve el `order` del bullet: lo consume ya ordenado.
    items: p.items.map((i) => ({ id: i.id, text: i.text, included: i.included })),
  };
}

export function mapPaqueteAdmin(p: FilaPaqueteAdmin, storage: StorageService): AdminPackageDto {
  return {
    ...mapPaquete(p, storage),
    items: p.items.map((i) => ({ id: i.id, text: i.text, included: i.included, order: i.order })),
    isActive: p.isActive,
    order: p.order,
    accentColor: p.accentColor,
    categoryIds: p.categories.map((c) => c.categoryId),
    whatsappClickCount: p._count.whatsappClicks,
  };
}
