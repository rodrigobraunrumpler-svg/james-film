import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminDifferentiatorDto,
  AdminSocialLinkDto,
  DifferentiatorDto,
  SiteSettingsDto,
  SocialLinkDto,
} from '@james-film/contracts';
import { textoLimpio } from '../../common/opcional.js';
import { ReorderService } from '../../common/services/reorder.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';
import type { CreateDifferentiatorDto, UpdateDifferentiatorDto } from './dto/differentiator.dto.js';
import type { CreateSocialLinkDto, UpdateSocialLinkDto } from './dto/social-link.dto.js';
import {
  SELECT_AJUSTES,
  SELECT_DIFERENCIADOR,
  SELECT_RED,
  mapAjustes,
  mapDiferenciador,
  mapDiferenciadorAdmin,
  mapRed,
  mapRedAdmin,
} from './settings.mapper.js';

const SINGLETON = 'singleton';
const ORDEN = [{ order: 'asc' as const }, { id: 'asc' as const }];

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly reorder: ReorderService,
  ) {}

  // ------------------------------------------------------------- ajustes

  async leer(): Promise<SiteSettingsDto> {
    // `upsert` y no `findUnique`: si el seed no corrió, la landing se quedaría
    // sin nada que pintar y el admin sin nada que editar.
    const fila = await this.prisma.siteSettings.upsert({
      where: { id: SINGLETON },
      update: {},
      create: { id: SINGLETON },
      select: SELECT_AJUSTES,
    });
    return mapAjustes(fila, this.storage);
  }

  async actualizar(dto: UpdateSettingsDto): Promise<SiteSettingsDto> {
    const datos = {
      brandName: dto.brandName?.trim(),
      role: textoLimpio(dto.role),
      tagline: textoLimpio(dto.tagline),
      slogan: textoLimpio(dto.slogan),
      // `aboutText` NO se recorta con textoLimpio: los saltos de línea son
      // parte del texto y `trim()` solo quita los de los extremos, pero una
      // cadena de solo espacios sí debe quedar en null.
      aboutText: textoLimpio(dto.aboutText),
      logoKey: textoLimpio(dto.logoKey),
      signatureKey: textoLimpio(dto.signatureKey),
      whatsappNumber: textoLimpio(dto.whatsappNumber),
      whatsappDisplay: textoLimpio(dto.whatsappDisplay),
      whatsappMessage: textoLimpio(dto.whatsappMessage),
      ctaText: textoLimpio(dto.ctaText),
      email: textoLimpio(dto.email),
      heroMediaKey: textoLimpio(dto.heroMediaKey),
      heroPosterKey: textoLimpio(dto.heroPosterKey),
      footerTagline: textoLimpio(dto.footerTagline),
      metaTitle: textoLimpio(dto.metaTitle),
      metaDescription: textoLimpio(dto.metaDescription),
      ogImageKey: textoLimpio(dto.ogImageKey),
    };

    await this.prisma.siteSettings.upsert({
      where: { id: SINGLETON },
      update: datos,
      create: { id: SINGLETON, ...datos },
    });

    return this.leer();
  }

  // ----------------------------------------------------- diferenciadores

  async listarDiferenciadores(soloActivos: boolean): Promise<DifferentiatorDto[]> {
    const filas = await this.prisma.differentiator.findMany({
      where: soloActivos ? { isActive: true } : {},
      select: SELECT_DIFERENCIADOR,
      orderBy: ORDEN,
    });
    return filas.map(mapDiferenciador);
  }

  async listarDiferenciadoresAdmin(): Promise<AdminDifferentiatorDto[]> {
    const filas = await this.prisma.differentiator.findMany({
      select: SELECT_DIFERENCIADOR,
      orderBy: ORDEN,
    });
    return filas.map(mapDiferenciadorAdmin);
  }

  async crearDiferenciador(dto: CreateDifferentiatorDto): Promise<AdminDifferentiatorDto> {
    await this.asegurarTituloLibre(dto.title);
    const { _max } = await this.prisma.differentiator.aggregate({ _max: { order: true } });

    const creado = await this.prisma.differentiator.create({
      data: {
        title: dto.title.trim(),
        subtitle: textoLimpio(dto.subtitle),
        icon: dto.icon,
        isActive: dto.isActive ?? true,
        order: (_max.order ?? -1) + 1,
      },
      select: SELECT_DIFERENCIADOR,
    });
    return mapDiferenciadorAdmin(creado);
  }

  async actualizarDiferenciador(
    id: string,
    dto: UpdateDifferentiatorDto,
  ): Promise<AdminDifferentiatorDto> {
    if (dto.title) await this.asegurarTituloLibre(dto.title, id);

    const actualizado = await this.prisma.differentiator
      .update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          subtitle: textoLimpio(dto.subtitle),
          icon: dto.icon,
          isActive: dto.isActive,
        },
        select: SELECT_DIFERENCIADOR,
      })
      .catch(() => {
        throw new NotFoundException();
      });
    return mapDiferenciadorAdmin(actualizado);
  }

  async borrarDiferenciador(id: string): Promise<void> {
    await this.prisma.differentiator.delete({ where: { id } }).catch(() => {
      throw new NotFoundException();
    });
  }

  reordenarDiferenciadores(ids: string[]): Promise<AdminDifferentiatorDto[]> {
    return this.reorder
      .reorder(this.prisma.differentiator, ids)
      .then(() => this.listarDiferenciadoresAdmin());
  }

  // ---------------------------------------------------------------- redes

  async listarRedes(soloActivas: boolean): Promise<SocialLinkDto[]> {
    const filas = await this.prisma.socialLink.findMany({
      where: soloActivas ? { isActive: true } : {},
      select: SELECT_RED,
      orderBy: ORDEN,
    });
    return filas.map(mapRed);
  }

  async listarRedesAdmin(): Promise<AdminSocialLinkDto[]> {
    const filas = await this.prisma.socialLink.findMany({ select: SELECT_RED, orderBy: ORDEN });
    return filas.map(mapRedAdmin);
  }

  async crearRed(dto: CreateSocialLinkDto): Promise<AdminSocialLinkDto> {
    await this.asegurarPlataformaLibre(dto.platform);
    const { _max } = await this.prisma.socialLink.aggregate({ _max: { order: true } });

    const creada = await this.prisma.socialLink.create({
      data: {
        platform: dto.platform.trim().toLowerCase(),
        handle: dto.handle.trim(),
        url: dto.url.trim(),
        icon: textoLimpio(dto.icon),
        isActive: dto.isActive ?? true,
        order: (_max.order ?? -1) + 1,
      },
      select: SELECT_RED,
    });
    return mapRedAdmin(creada);
  }

  async actualizarRed(id: string, dto: UpdateSocialLinkDto): Promise<AdminSocialLinkDto> {
    if (dto.platform) await this.asegurarPlataformaLibre(dto.platform, id);

    const actualizada = await this.prisma.socialLink
      .update({
        where: { id },
        data: {
          platform: dto.platform?.trim().toLowerCase(),
          handle: dto.handle?.trim(),
          url: dto.url?.trim(),
          icon: textoLimpio(dto.icon),
          isActive: dto.isActive,
        },
        select: SELECT_RED,
      })
      .catch(() => {
        throw new NotFoundException();
      });
    return mapRedAdmin(actualizada);
  }

  async borrarRed(id: string): Promise<void> {
    await this.prisma.socialLink.delete({ where: { id } }).catch(() => {
      throw new NotFoundException();
    });
  }

  reordenarRedes(ids: string[]): Promise<AdminSocialLinkDto[]> {
    return this.reorder.reorder(this.prisma.socialLink, ids).then(() => this.listarRedesAdmin());
  }

  // -------------------------------------------------------------- privado

  /**
   * Se comprueba ANTES de escribir para poder nombrar el campo. Dejarlo caer en
   * el P2002 daría un 409 con mensaje genérico, y aquí hay dos `@unique`
   * distintos: sin decir cuál, el aviso no sirve de nada.
   */
  private async asegurarTituloLibre(title: string, exceptoId?: string): Promise<void> {
    const existe = await this.prisma.differentiator.findUnique({
      where: { title: title.trim() },
      select: { id: true },
    });
    if (existe && existe.id !== exceptoId) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Ya hay un diferenciador con ese título.',
      });
    }
  }

  private async asegurarPlataformaLibre(platform: string, exceptoId?: string): Promise<void> {
    const existe = await this.prisma.socialLink.findUnique({
      where: { platform: platform.trim().toLowerCase() },
      select: { id: true },
    });
    if (existe && existe.id !== exceptoId) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Ya hay un enlace para esa red.',
      });
    }
  }
}
