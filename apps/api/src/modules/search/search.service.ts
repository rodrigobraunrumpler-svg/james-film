import { Injectable } from '@nestjs/common';
import type { SearchResultDto } from '@james-film/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { claveDePortada } from '../galleries/galleries.mapper.js';

/**
 * Cuatro de cada tipo. El atajo no es una pantalla de resultados: es para
 * llegar a algo que ya sabes que existe, y una lista que no cabe en la caja
 * obliga a scrollear justo cuando ibas a pulsar Enter.
 */
const POR_TIPO = 4;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * `q` ya viene recortado y no vacío: el DTO lo garantiza. Se busca en los
   * cuatro modelos a la vez y se devuelve plano — el atajo pinta cualquier tipo
   * con el mismo componente, así que el quinto modelo no tocará la interfaz.
   */
  async buscar(q: string): Promise<SearchResultDto[]> {
    const contiene = { contains: q, mode: 'insensitive' as const };

    const [galerias, paquetes, categorias, testimonios] = await Promise.all([
      this.prisma.gallery.findMany({
        where: { deletedAt: null, title: contiene },
        select: {
          id: true,
          title: true,
          isPublished: true,
          _count: { select: { media: { where: { deletedAt: null } } } },
          media: {
            where: { isFeatured: true, deletedAt: null },
            select: { isFeatured: true, posterKey: true, storageKey: true, type: true },
            take: 1,
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: POR_TIPO,
      }),
      this.prisma.package.findMany({
        where: { name: contiene },
        select: { id: true, name: true, subtitle: true },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        take: POR_TIPO,
      }),
      this.prisma.category.findMany({
        where: { name: contiene },
        select: {
          id: true,
          name: true,
          coverKey: true,
          _count: { select: { galleries: true } },
        },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        take: POR_TIPO,
      }),
      this.prisma.testimonial.findMany({
        where: { authorName: contiene },
        select: { id: true, authorName: true, isActive: true },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        take: POR_TIPO,
      }),
    ]);

    return [
      ...galerias.map((g): SearchResultDto => {
        const clave = claveDePortada(g.media);
        return {
          kind: 'GALLERY',
          id: g.id,
          label: g.title,
          // El estado importa más que el recuento: lo primero que hay que saber
          // de una galería es si está en vivo.
          hint: g.isPublished
            ? `${g._count.media} ${g._count.media === 1 ? 'medio' : 'medios'}`
            : 'Borrador',
          href: `/galerias/${g.id}`,
          coverUrl: clave ? this.storage.getPublicUrl(clave) : null,
        };
      }),
      ...paquetes.map(
        (p): SearchResultDto => ({
          kind: 'PACKAGE',
          id: p.id,
          label: p.name,
          hint: p.subtitle,
          href: '/paquetes',
          coverUrl: null,
        }),
      ),
      ...categorias.map(
        (c): SearchResultDto => ({
          kind: 'CATEGORY',
          id: c.id,
          label: c.name,
          hint: `${c._count.galleries} ${c._count.galleries === 1 ? 'galería' : 'galerías'}`,
          href: '/categorias',
          coverUrl: c.coverKey ? this.storage.getPublicUrl(c.coverKey) : null,
        }),
      ),
      ...testimonios.map(
        (t): SearchResultDto => ({
          kind: 'TESTIMONIAL',
          id: t.id,
          label: t.authorName,
          hint: t.isActive ? 'Publicado' : 'Oculto',
          href: '/testimonios',
          coverUrl: null,
        }),
      ),
    ];
  }
}
