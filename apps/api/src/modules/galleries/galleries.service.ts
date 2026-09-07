import { Injectable, NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  AdminGalleryDto,
  AdminGalleryListItemDto,
  GalleryCountsDto,
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
  SELECT_GALERIA,
  SELECT_MEDIA,
  SELECT_MEDIA_ADMIN,
  mapGaleria,
  mapGaleriaAdmin,
  mapGaleriaLista,
  mapGaleriaListaAdmin,
  SELECT_GALERIA_ADMIN,
} from './galleries.mapper.js';
import type { EstadoGaleria } from './dto/list-galleries.dto.js';

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

    const fotos = await this.fotosPorGaleria(
      filas.map((f) => f.id),
      MEDIA_VISIBLE,
    );

    return paginar(
      filas.map((f) => mapGaleriaLista(f, this.storage, fotos.get(f.id) ?? 0)),
      total,
      page,
      pageSize,
    );
  }

  /**
   * Cuántas FOTOS visibles tiene cada galería de la página.
   *
   * Va en su propia consulta porque Prisma solo admite **un `_count` por
   * relación**: no se puede pedir «todos los medios» y «solo las fotos» en el
   * mismo `select`. Un `groupBy` es UN viaje más por página —no uno por
   * galería— y ataca el mismo índice que el recuento.
   *
   * La alternativa era traerse los `type` de todos los medios de todas las
   * galerías, que es exactamente lo que la lista pública no hace: una respuesta
   * que crece sin techo con cada evento.
   */
  private async fotosPorGaleria(
    ids: string[],
    where: Record<string, unknown>,
  ): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const filas = await this.prisma.media.groupBy({
      by: ['galleryId'],
      where: { ...where, galleryId: { in: ids }, type: 'PHOTO' },
      _count: { _all: true },
    });
    return new Map(filas.map((f) => [f.galleryId, f._count._all]));
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
    estado: EstadoGaleria = 'todas',
    q?: string,
  ): Promise<ListaPaginada<AdminGalleryListItemDto>> {
    // `undefined` deja el campo fuera del WHERE; `true`/`false` lo filtran.
    const where = {
      deletedAt: null,
      isPublished: estado === 'todas' ? undefined : estado === 'publicadas',
      // `mode: 'insensitive'` porque James escribe «camila» buscando «XV de Camila».
      // Sin índice: con decenas de filas el seq scan es más rápido que un GIN.
      title: q ? { contains: q, mode: 'insensitive' as const } : undefined,
    };
    const [filas, total] = await this.prisma.$transaction([
      this.prisma.gallery.findMany({
        where,
        select: {
          ...SELECT_GALERIA_ADMIN,
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

    const fotos = await this.fotosPorGaleria(
      filas.map((f) => f.id),
      { deletedAt: null, status: 'READY' },
    );

    return paginar(
      filas.map((f) => mapGaleriaListaAdmin(f, this.storage, fotos.get(f.id) ?? 0)),
      total,
      page,
      pageSize,
    );
  }

  /**
   * Los tres números de las pestañas, en UNA consulta. Endpoint aparte y no un
   * campo del meta paginado: los recuentos NO dependen del filtro activo, y
   * meterlos en la respuesta filtrada obligaría a recalcularlos en cada página.
   */
  async contar(): Promise<GalleryCountsDto> {
    const grupos = await this.prisma.gallery.groupBy({
      by: ['isPublished'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const publicadas = grupos.find((g) => g.isPublished)?._count._all ?? 0;
    const borradores = grupos.find((g) => !g.isPublished)?._count._all ?? 0;
    return { todas: publicadas + borradores, publicadas, borradores };
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
    const actual = await this.asegurarQueExiste(id);

    /**
     * PUBLICAR EXIGE CONSENTIMIENTO, igual que en los testimonios.
     *
     * En una galería salen caras de gente real, y en los XV años salen
     * **menores**: hasta ahora publicar era un botón sin fricción sobre lo
     * único que puede traerle un problema de verdad a James (Ley 29733 y art.
     * 15 del Código Civil). El booleano no acredita nada por sí solo — lo
     * acredita la hoja firmada de `docs/legal/` —, pero es la puerta que obliga
     * a pararse a comprobar que existe.
     *
     * Se mira el valor que va a QUEDAR, no el que llega: publicar y marcar el
     * consentimiento en el mismo `PATCH` es válido, y despublicar nunca se
     * bloquea.
     */
    const consentira = dto.hasConsent ?? actual.hasConsent;
    const publicara = dto.isPublished ?? actual.isPublished;
    if (publicara && !consentira) {
      throw new UnprocessableEntityException({
        code: 'CONSENT_REQUIRED',
        message:
          'No se puede publicar una galería sin la autorización de imagen firmada. ' +
          'Márcala primero.',
      });
    }

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
        hasConsent: dto.hasConsent,
        // `isFeatured` NO se escribe aquí cuando se enciende: lo hace
        // `setOnly` justo debajo, que además apaga las demás.
        isFeatured: dto.isFeatured === true ? undefined : dto.isFeatured,
      },
    });

    /**
     * DESTACADA hay UNA, como el paquete destacado y como la portada de una
     * galería. No estaba forzado y era un booleano suelto por fila.
     *
     * Lo único que hace este campo es ganar el `orderBy` de la lista pública
     * (`isFeatured desc, order asc, id asc`), o sea **poner esa galería la
     * primera** — y de ahí sale el trabajo que encabeza el hero, la tarjeta
     * alta del bento y la rejilla. Con varias marcadas, «la primera» la decidía
     * el `order` y las otras dos marcas no hacían nada: el panel decía que tres
     * galerías estaban destacadas y en la web solo se notaba una. Un control que
     * miente sobre su efecto es peor que no tenerlo.
     */
    if (dto.isFeatured === true) {
      await this.exclusiveFlag.setOnly(this.prisma.gallery, 'isFeatured', id);
    }

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

  /**
   * Devuelve el estado que hace falta para decidir, no solo el id.
   *
   * `isPublished` y `hasConsent` porque publicar se decide sobre el valor que
   * va a QUEDAR: un `PATCH` que solo trae `isPublished` tiene que mirar el
   * consentimiento que ya estaba, y uno que trae los dos vale.
   */
  private async asegurarQueExiste(
    id: string,
  ): Promise<{ isPublished: boolean; hasConsent: boolean }> {
    const existe = await this.prisma.gallery.findFirst({
      where: { id, deletedAt: null },
      select: { isPublished: true, hasConsent: true },
    });
    if (!existe) throw new NotFoundException();
    return existe;
  }
}
