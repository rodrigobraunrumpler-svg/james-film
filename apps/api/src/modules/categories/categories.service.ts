import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminCategoryDto,
  CategoryClickShareDto,
  CategoryDto,
} from '@james-film/contracts';
import { textoLimpio } from '../../common/opcional.js';
import { ReorderService } from '../../common/services/reorder.service.js';
import { SlugService } from '../../common/services/slug.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';
import {
  SELECT_CATEGORIA,
  SELECT_CATEGORIA_ADMIN,
  mapCategoria,
  mapCategoriaAdmin,
} from './categories.mapper.js';

const CONTEOS = { _count: { select: { galleries: true, packages: true } } } as const;

/**
 * Las tres galerías publicadas más recientes, solo con su medio destacado. Es
 * lo que convierte la tarjeta de categoría de un nombre en algo que enseña qué
 * hay dentro. Tres y no más: en la tarjeta caben tres.
 */
const RECIENTES = {
  galleries: {
    where: { isPublished: true, deletedAt: null },
    select: {
      media: {
        where: { isFeatured: true, deletedAt: null, status: 'READY' as const },
        select: { isFeatured: true, posterKey: true, storageKey: true, type: true },
        take: 1,
      },
    },
    orderBy: [{ eventDate: 'desc' as const }, { id: 'asc' as const }],
    take: 3,
  },
};

/** Los clics de los últimos 30 días, la misma ventana móvil que usa el panel. */
const VENTANA_CLICS_MS = 30 * 86_400_000;

/**
 * `order` empata por defecto (`@default(0)`), y sin desempate Postgres puede
 * devolverlas en distinto orden entre dos builds de Astro: la sección se movería
 * sola sin que nadie haya tocado nada. Por eso termina en `{ id: 'asc' }` aunque
 * aquí no haya paginación.
 */
const ORDEN = [{ order: 'asc' as const }, { id: 'asc' as const }];

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly slug: SlugService,
    private readonly reorder: ReorderService,
  ) {}

  async listarPublicas(): Promise<CategoryDto[]> {
    const filas = await this.prisma.category.findMany({
      where: { isActive: true },
      select: SELECT_CATEGORIA,
      orderBy: ORDEN,
    });
    return filas.map((f) => mapCategoria(f, this.storage));
  }

  async listarTodas(ahora = new Date()): Promise<AdminCategoryDto[]> {
    const [filas, mixPorCategoria] = await Promise.all([
      this.prisma.category.findMany({
        select: { ...SELECT_CATEGORIA_ADMIN, ...CONTEOS, ...RECIENTES },
        orderBy: ORDEN,
      }),
      this.clicsPorCategoria(ahora),
    ]);
    return filas.map((f) => mapCategoriaAdmin(f, this.storage, mixPorCategoria.get(f.id) ?? []));
  }

  /**
   * A qué paquete van los clics de cada categoría. Se DERIVA por
   * `PackageCategory` en vez de añadir una columna `categoryId` al clic: la
   * relación ya existe, y una columna denormalizada quedaría desfasada en
   * cuanto James moviera un paquete de categoría.
   *
   * Dos consultas para las cuatro categorías, no una por tarjeta.
   */
  private async clicsPorCategoria(ahora: Date): Promise<Map<string, CategoryClickShareDto[]>> {
    const desde = new Date(ahora.getTime() - VENTANA_CLICS_MS);

    const [clics, vinculos] = await Promise.all([
      this.prisma.whatsappClick.groupBy({
        by: ['packageId'],
        where: { createdAt: { gte: desde }, packageId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.packageCategory.findMany({
        select: { categoryId: true, package: { select: { id: true, name: true } } },
      }),
    ]);

    const porPaquete = new Map(
      clics
        .filter((c) => c.packageId !== null)
        .map((c) => [c.packageId as string, c._count._all]),
    );

    const salida = new Map<string, CategoryClickShareDto[]>();
    for (const v of vinculos) {
      const count = porPaquete.get(v.package.id) ?? 0;
      if (count === 0) continue;
      const lista = salida.get(v.categoryId) ?? [];
      lista.push({ packageId: v.package.id, packageName: v.package.name, count });
      salida.set(v.categoryId, lista);
    }

    // Desempate por id: sin él, dos paquetes con los mismos clics podrían
    // cambiar de sitio entre dos cargas y la barra parecería moverse sola.
    for (const [k, lista] of salida) {
      salida.set(
        k,
        lista.sort((a, b) => b.count - a.count || a.packageId.localeCompare(b.packageId)),
      );
    }
    return salida;
  }

  async crear(dto: CreateCategoryDto): Promise<AdminCategoryDto> {
    const slug = await this.slug.unique(dto.name, async (candidato) => {
      // `Category` no tiene soft delete, así que el sondeo es el normal.
      const existe = await this.prisma.category.findUnique({
        where: { slug: candidato },
        select: { id: true },
      });
      return existe !== null;
    });

    const { _max } = await this.prisma.category.aggregate({ _max: { order: true } });

    const creada = await this.prisma.category.create({
      data: {
        slug,
        name: dto.name.trim(),
        tagline: textoLimpio(dto.tagline),
        description: textoLimpio(dto.description),
        coverKey: textoLimpio(dto.coverKey),
        metaTitle: textoLimpio(dto.metaTitle),
        metaDescription: textoLimpio(dto.metaDescription),
        isActive: dto.isActive ?? true,
        // Las nuevas van AL FINAL: con `order @default(0)` se colarían entre las
        // primeras de una lista ya ordenada.
        order: (_max.order ?? -1) + 1,
      },
      select: { id: true },
    });

    return this.porId(creada.id);
  }

  async actualizar(id: string, dto: UpdateCategoryDto): Promise<AdminCategoryDto> {
    await this.asegurarQueExiste(id);

    await this.prisma.category.update({
      where: { id },
      data: {
        // `undefined` NO TOCA, `null` BORRA. `textoLimpio` conserva la
        // distinción: `dto.campo?.trim()` la habría colapsado.
        name: dto.name?.trim(),
        slug: dto.slug?.trim(),
        tagline: textoLimpio(dto.tagline),
        description: textoLimpio(dto.description),
        coverKey: textoLimpio(dto.coverKey),
        metaTitle: textoLimpio(dto.metaTitle),
        metaDescription: textoLimpio(dto.metaDescription),
        isActive: dto.isActive,
      },
    });

    return this.porId(id);
  }

  /**
   * Cuenta ANTES de intentar borrar. Dejarlo caer en el P2003 de Postgres daría
   * un 409 sin el número, y el número es justo lo accionable: «no se puede,
   * 4 galerías están aquí» frente a «restricción de clave foránea».
   *
   * Y cuenta también los paquetes, aunque Postgres no se queje de ellos:
   * `PackageCategory` es **Cascade**, así que el borrado los desvincularía **en
   * silencio**.
   */
  async borrar(id: string): Promise<void> {
    const categoria = await this.prisma.category.findUnique({
      where: { id },
      select: CONTEOS,
    });
    if (!categoria) throw new NotFoundException();

    const { galleries, packages } = categoria._count;
    if (galleries > 0 || packages > 0) {
      throw new ConflictException({
        code: 'CATEGORY_IN_USE',
        message: `No se puede borrar: ${enumerar(galleries, packages)} usan esta categoría.`,
      });
    }

    await this.prisma.category.delete({ where: { id } });
  }

  reordenar(ids: string[]): Promise<AdminCategoryDto[]> {
    return this.reorder.reorder(this.prisma.category, ids).then(() => this.listarTodas());
  }

  // ---------------------------------------------------------------- privado

  private async porId(id: string, ahora = new Date()): Promise<AdminCategoryDto> {
    const [fila, mix] = await Promise.all([
      this.prisma.category.findUnique({
        where: { id },
        select: { ...SELECT_CATEGORIA_ADMIN, ...CONTEOS, ...RECIENTES },
      }),
      this.clicsPorCategoria(ahora),
    ]);
    if (!fila) throw new NotFoundException();
    return mapCategoriaAdmin(fila, this.storage, mix.get(id) ?? []);
  }

  private async asegurarQueExiste(id: string): Promise<void> {
    const existe = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException();
  }
}

const enumerar = (galerias: number, paquetes: number): string => {
  const partes: string[] = [];
  if (galerias > 0) partes.push(`${galerias} ${galerias === 1 ? 'galería' : 'galerías'}`);
  if (paquetes > 0) partes.push(`${paquetes} ${paquetes === 1 ? 'paquete' : 'paquetes'}`);
  return partes.join(' y ');
};
