import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminCategoryDto, CategoryDto } from '@james-film/contracts';
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

  async listarTodas(): Promise<AdminCategoryDto[]> {
    const filas = await this.prisma.category.findMany({
      select: { ...SELECT_CATEGORIA_ADMIN, ...CONTEOS },
      orderBy: ORDEN,
    });
    return filas.map((f) => mapCategoriaAdmin(f, this.storage));
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

  private async porId(id: string): Promise<AdminCategoryDto> {
    const fila = await this.prisma.category.findUnique({
      where: { id },
      select: { ...SELECT_CATEGORIA_ADMIN, ...CONTEOS },
    });
    if (!fila) throw new NotFoundException();
    return mapCategoriaAdmin(fila, this.storage);
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
