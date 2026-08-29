import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminPackageDto, PackageDto } from '@james-film/contracts';
import { textoLimpio } from '../../common/opcional.js';
import { ExclusiveFlagService } from '../../common/services/exclusive-flag.service.js';
import { ReorderService } from '../../common/services/reorder.service.js';
import { SlugService } from '../../common/services/slug.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import type { CreatePackageDto } from './dto/create-package.dto.js';
import type { PackageItemInputDto } from './dto/package-item.dto.js';
import type { UpdatePackageDto } from './dto/update-package.dto.js';
import {
  SELECT_ITEM,
  SELECT_PAQUETE,
  SELECT_PAQUETE_ADMIN,
  mapPaquete,
  mapPaqueteAdmin,
} from './packages.mapper.js';

const ORDEN = [{ order: 'asc' as const }, { id: 'asc' as const }];
const ORDEN_ITEMS = { orderBy: ORDEN, select: SELECT_ITEM } as const;
const EXTRA_ADMIN = {
  items: ORDEN_ITEMS,
  categories: { select: { categoryId: true } },
  _count: { select: { whatsappClicks: true } },
} as const;

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly slug: SlugService,
    private readonly reorder: ReorderService,
    private readonly exclusiveFlag: ExclusiveFlagService,
  ) {}

  async listarPublicos(): Promise<PackageDto[]> {
    const filas = await this.prisma.package.findMany({
      where: { isActive: true },
      select: { ...SELECT_PAQUETE, items: ORDEN_ITEMS },
      // El destacado primero, sin salirse de la lista: la landing decide cómo
      // pintarlo sin que la API prejuzgue el diseño.
      orderBy: [{ isHighlighted: 'desc' }, ...ORDEN],
    });
    return filas.map((f) => mapPaquete(f, this.storage));
  }

  async listarTodos(): Promise<AdminPackageDto[]> {
    const filas = await this.prisma.package.findMany({
      select: { ...SELECT_PAQUETE_ADMIN, ...EXTRA_ADMIN },
      orderBy: [{ isHighlighted: 'desc' }, ...ORDEN],
    });
    return filas.map((f) => mapPaqueteAdmin(f, this.storage));
  }

  async crear(dto: CreatePackageDto): Promise<AdminPackageDto> {
    const slug = await this.slug.unique(dto.name, async (candidato) => {
      const existe = await this.prisma.package.findUnique({
        where: { slug: candidato },
        select: { id: true },
      });
      return existe !== null;
    });

    const { _max } = await this.prisma.package.aggregate({ _max: { order: true } });

    const creado = await this.prisma.package.create({
      data: {
        slug,
        name: dto.name.trim(),
        ...this.camposOpcionales(dto),
        isActive: dto.isActive ?? true,
        order: (_max.order ?? -1) + 1,
        items: {
          create: (dto.items ?? []).map((item, order) => ({
            text: item.text.trim(),
            included: item.included ?? true,
            order,
          })),
        },
        categories: {
          create: (dto.categoryIds ?? []).map((categoryId) => ({ categoryId })),
        },
      },
      select: { id: true },
    });

    if (dto.isHighlighted) await this.destacar(creado.id);
    return this.porId(creado.id);
  }

  async actualizar(id: string, dto: UpdatePackageDto): Promise<AdminPackageDto> {
    await this.asegurarQueExiste(id);
    if (dto.items) await this.asegurarItemsPropios(id, dto.items);

    await this.prisma.$transaction(async (tx) => {
      await tx.package.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug: dto.slug?.trim(),
          ...this.camposOpcionales(dto),
          isActive: dto.isActive,
        },
      });

      if (dto.items) {
        const recibidos = dto.items.filter((i) => i.id).map((i) => i.id!);
        // Los que ya no vienen se borran; los ids que sí vienen SOBREVIVEN,
        // porque son la clave de React de cada fila: recrearlos remontaría la
        // lista en cada guardado y el foco saltaría del campo que se escribe.
        await tx.packageItem.deleteMany({
          where: { packageId: id, id: { notIn: recibidos.length ? recibidos : ['-'] } },
        });

        for (const [order, item] of dto.items.entries()) {
          const datos = { text: item.text.trim(), included: item.included ?? true, order };
          if (item.id) {
            await tx.packageItem.update({ where: { id: item.id }, data: datos });
          } else {
            await tx.packageItem.create({ data: { ...datos, packageId: id } });
          }
        }
      }

      if (dto.categoryIds) {
        // Pivote sin campos propios: reemplazo entero dentro de la misma
        // transacción, para que no exista un instante sin vínculos.
        await tx.packageCategory.deleteMany({ where: { packageId: id } });
        await tx.packageCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({ packageId: id, categoryId })),
        });
      }
    });

    if (dto.isHighlighted === true) await this.destacar(id);
    return this.porId(id);
  }

  /** Exclusivo GLOBAL: aquí no hay `scope`, solo puede haber un destacado. */
  async destacar(id: string): Promise<AdminPackageDto> {
    await this.asegurarQueExiste(id);
    await this.exclusiveFlag.setOnly(this.prisma.package, 'isHighlighted', id);
    return this.porId(id);
  }

  async borrar(id: string): Promise<void> {
    const paquete = await this.prisma.package.findUnique({
      where: { id },
      select: { _count: { select: { whatsappClicks: true } } },
    });
    if (!paquete) throw new NotFoundException();

    // Borrarlo pone `packageId: null` en cada clic —la relación es SetNull— y
    // esos clics son la única métrica de negocio del proyecto. Con historial,
    // la acción correcta es desactivar.
    if (paquete._count.whatsappClicks > 0) {
      throw new BadRequestException({
        code: 'CONFLICT',
        message:
          `Este paquete tiene ${paquete._count.whatsappClicks} clics a WhatsApp registrados. ` +
          `Desactívalo en vez de borrarlo, o perderás esa información.`,
      });
    }

    await this.prisma.package.delete({ where: { id } });
  }

  reordenar(ids: string[]): Promise<AdminPackageDto[]> {
    return this.reorder.reorder(this.prisma.package, ids).then(() => this.listarTodos());
  }

  // ---------------------------------------------------------------- privado

  /** `null` BORRA, `undefined` NO TOCA. Un solo sitio para los diez opcionales. */
  private camposOpcionales(dto: CreatePackageDto | UpdatePackageDto) {
    return {
      subtitle: textoLimpio(dto.subtitle),
      priceAmount: dto.priceAmount,
      priceNote: textoLimpio(dto.priceNote),
      idealFor: textoLimpio(dto.idealFor),
      icon: textoLimpio(dto.icon),
      imageKey: textoLimpio(dto.imageKey),
      accentColor: textoLimpio(dto.accentColor),
      badgeText: textoLimpio(dto.badgeText),
      whatsappMessage: textoLimpio(dto.whatsappMessage),
    };
  }

  /**
   * Un `id` de un bullet de OTRO paquete pasaría el update y lo movería de
   * sitio. No hay índice único `(id, packageId)` que lo impida, así que se
   * comprueba aquí, antes de abrir la transacción.
   */
  private async asegurarItemsPropios(id: string, items: PackageItemInputDto[]): Promise<void> {
    const ids = items.map((i) => i.id).filter((v): v is string => Boolean(v));
    if (ids.length === 0) return;

    const propios = await this.prisma.packageItem.count({
      where: { packageId: id, id: { in: ids } },
    });
    if (propios !== ids.length) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Alguno de los puntos no pertenece a este paquete.',
      });
    }
  }

  private async porId(id: string): Promise<AdminPackageDto> {
    const fila = await this.prisma.package.findUnique({
      where: { id },
      select: { ...SELECT_PAQUETE_ADMIN, ...EXTRA_ADMIN },
    });
    if (!fila) throw new NotFoundException();
    return mapPaqueteAdmin(fila, this.storage);
  }

  private async asegurarQueExiste(id: string): Promise<void> {
    const existe = await this.prisma.package.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException();
  }
}
