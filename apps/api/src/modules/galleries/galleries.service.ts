import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminGalleryDto,
  AdminGalleryListItemDto,
  CategoryRefDto,
  GalleryDto,
  GalleryListItemDto,
} from '@james-film/contracts';
import type { ListaPaginada } from '../../common/interceptors/response-envelope.interceptor.js';
import { fechaDeCalendario } from '../../common/opcional.js';
import { paginar } from '../../common/pagination.js';
import { ExclusiveFlagService } from '../../common/services/exclusive-flag.service.js';
import { ReorderService } from '../../common/services/reorder.service.js';
import { SlugService } from '../../common/services/slug.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import type { CreateGalleryDto } from './dto/create-gallery.dto.js';
import type { UpdateGalleryDto } from './dto/update-gallery.dto.js';
import {
  SELECT_CATEGORIA,
  SELECT_GALERIA,
  SELECT_MEDIA,
  SELECT_MEDIA_ADMIN,
  mapGaleria,
  mapGaleriaAdmin,
  mapGaleriaListaAdmin,
} from './galleries.mapper.js';

/** Lo que la landing puede ver: publicada, no borrada. */
const VISIBLE = { isPublished: true, deletedAt: null } as const;
/** Y solo sus medios listos: un PENDING todavía no existe para el visitante. */
const MEDIA_VISIBLE = { status: 'READY', deletedAt: null } as const;

@Injectable()
export class GalleriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly slug: SlugService,
    private readonly reorder: ReorderService,
    private readonly exclusiveFlag: ExclusiveFlagService,
  ) {}

  /**
   * Las opciones del `<select>` de categoría del editor. Vive aquí y no en un
   * módulo propio porque hasta la fase 4 esto es lo único que se necesita de
   * `Category`: un módulo con un solo `findMany` sería un archivo de más.
   */
  async listarCategorias(): Promise<CategoryRefDto[]> {
    return this.prisma.category.findMany({
      select: SELECT_CATEGORIA,
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
  }

  async listarPublicas(page: number, pageSize: number): Promise<ListaPaginada<GalleryListItemDto>> {
    const [filas, total] = await this.prisma.$transaction([
      this.prisma.gallery.findMany({
        where: VISIBLE,
        select: {
          ...SELECT_GALERIA,
          _count: { select: { media: { where: MEDIA_VISIBLE } } },
          // Solo la portada: es lo que necesita claveDePortada para derivar coverUrl.
          media: { where: { ...MEDIA_VISIBLE, isFeatured: true }, select: SELECT_MEDIA, take: 1 },
        },
        // El `{ id: 'asc' }` final NO es decorativo: con `order` empatado,
        // Postgres puede devolver las filas en distinto orden entre páginas y
        // una saldría dos veces mientras otra no sale nunca.
        orderBy: [{ isFeatured: 'desc' }, { order: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.gallery.count({ where: VISIBLE }),
    ]);

    return paginar(
      filas.map((f) => mapGaleriaListaAdmin(f, this.storage)),
      total,
      page,
      pageSize,
    );
  }

  async buscarPorSlug(slug: string): Promise<GalleryDto> {
    const fila = await this.prisma.gallery.findFirst({
      where: { slug, ...VISIBLE },
      select: {
        ...SELECT_GALERIA,
        media: {
          where: MEDIA_VISIBLE,
          select: SELECT_MEDIA,
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        },
      },
    });

    // 404 y no 403: un 403 confirmaría que ese slug existe, que es justo lo que
    // un borrador no debe revelar.
    if (!fila) throw new NotFoundException();
    return mapGaleria(fila, this.storage);
  }

  // ---------------------------------------------------------------- admin

  async listarTodas(
    page: number,
    pageSize: number,
  ): Promise<ListaPaginada<AdminGalleryListItemDto>> {
    const where = { deletedAt: null };
    const [filas, total] = await this.prisma.$transaction([
      this.prisma.gallery.findMany({
        where,
        select: {
          ...SELECT_GALERIA,
          // Solo READY: si no, "Medios · 8" cuenta también los que fallaron.
          _count: { select: { media: { where: { deletedAt: null, status: 'READY' } } } },
          media: { where: { deletedAt: null, isFeatured: true }, select: SELECT_MEDIA, take: 1 },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.gallery.count({ where }),
    ]);

    return paginar(
      filas.map((f) => mapGaleriaListaAdmin(f, this.storage)),
      total,
      page,
      pageSize,
    );
  }

  /**
   * Devuelve AdminGalleryDto, con `status` y `error` por medio: el editor tiene que
   * poder distinguir un medio subido de uno a medias tras una recarga. La anotación
   * del retorno es lo que hace que el `select` falle cerrado.
   */
  async buscarPorId(id: string): Promise<AdminGalleryDto> {
    const fila = await this.prisma.gallery.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...SELECT_GALERIA,
        media: {
          where: { deletedAt: null },
          select: SELECT_MEDIA_ADMIN,
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!fila) throw new NotFoundException();
    return mapGaleriaAdmin(fila, this.storage);
  }

  async crear(dto: CreateGalleryDto): Promise<AdminGalleryDto> {
    const slug = await this.slug.unique(dto.title, async (candidato) => {
      // A propósito SIN filtrar deletedAt: el índice Gallery_slug_key no es
      // parcial, así que el slug de una galería borrada sigue ocupado. Si aquí
      // se filtrara, diría "libre" y el create reventaría con P2002.
      const existe = await this.prisma.gallery.findUnique({
        where: { slug: candidato },
        select: { id: true },
      });
      return existe !== null;
    });

    const creada = await this.prisma.gallery.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
        eventDate: fechaDeCalendario(dto.eventDate) ?? null,
        location: dto.location,
      },
      select: { id: true },
    });

    return this.buscarPorId(creada.id);
  }

  async actualizar(id: string, dto: UpdateGalleryDto): Promise<AdminGalleryDto> {
    await this.asegurarQueExiste(id);

    // El slug NO se regenera al renombrar: James comparte links por WhatsApp
    // veinte veces al día y regenerarlo los rompe todos en silencio.
    await this.prisma.gallery.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
        // null BORRA, undefined NO TOCA. Con `dto.eventDate ? … : undefined`,
        // vaciar el campo se perdía en silencio y reaparecía al recargar.
        eventDate: fechaDeCalendario(dto.eventDate),
        location: dto.location,
        isPublished: dto.isPublished,
        isFeatured: dto.isFeatured,
      },
    });

    return this.buscarPorId(id);
  }

  async borrar(id: string): Promise<void> {
    await this.asegurarQueExiste(id);
    const deletedAt = new Date();

    // Se propaga a los medios EN LA MISMA TRANSACCIÓN. Sin esto, el Cascade de
    // Postgres borraría sus filas sin que la app las vea y los objetos quedarían
    // huérfanos en el bucket para siempre.
    await this.prisma.$transaction([
      this.prisma.media.updateMany({
        where: { galleryId: id, deletedAt: null },
        data: { deletedAt },
      }),
      this.prisma.gallery.update({ where: { id }, data: { deletedAt } }),
    ]);
  }

  async reordenarMedios(id: string, ids: string[]): Promise<AdminGalleryDto> {
    await this.asegurarQueExiste(id);
    await this.reorder.reorder(this.prisma.media, ids);
    return this.buscarPorId(id);
  }

  async marcarPortada(galleryId: string, mediaId: string): Promise<AdminGalleryDto> {
    await this.asegurarQueExiste(galleryId);
    // El `scope` es lo que hace la portada única POR GALERÍA: sin él, marcar la
    // de la boda de Ana desmarcaría la de los XV de Camila.
    await this.exclusiveFlag.setOnly(this.prisma.media, 'isFeatured', mediaId, { galleryId });
    return this.buscarPorId(galleryId);
  }

  private async asegurarQueExiste(id: string): Promise<void> {
    const existe = await this.prisma.gallery.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException();
  }
}
