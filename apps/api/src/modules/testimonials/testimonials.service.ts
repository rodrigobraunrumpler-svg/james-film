import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { AdminTestimonialDto, TestimonialDto } from '@james-film/contracts';
import { fechaDeCalendario, textoLimpio } from '../../common/opcional.js';
import { ExclusiveFlagService } from '../../common/services/exclusive-flag.service.js';
import { ReorderService } from '../../common/services/reorder.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import type { CreateTestimonialDto } from './dto/create-testimonial.dto.js';
import type { UpdateTestimonialDto } from './dto/update-testimonial.dto.js';
import {
  SELECT_TESTIMONIO,
  SELECT_TESTIMONIO_ADMIN,
  mapTestimonio,
  mapTestimonioAdmin,
} from './testimonials.mapper.js';

/**
 * Lo que la landing puede ver. **`hasConsent: true` no es negociable**: es la
 * Ley 29733 (§19), y hay menores en los XV años. Ningún parámetro lo desactiva.
 */
const PUBLICABLE = { isActive: true, hasConsent: true } as const;

/**
 * El destacado primero y el resto por orden, **sin salirse de la lista**: la
 * landing decide cómo pintarlo sin que la API prejuzgue el diseño.
 */
const ORDEN = [
  { isFeatured: 'desc' as const },
  { order: 'asc' as const },
  { id: 'asc' as const },
];

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly reorder: ReorderService,
    private readonly exclusiveFlag: ExclusiveFlagService,
  ) {}

  async listarPublicos(galleryId?: string): Promise<TestimonialDto[]> {
    const filas = await this.prisma.testimonial.findMany({
      // El filtro se compone; NUNCA se sustituye por lo que llegue de fuera.
      where: { ...PUBLICABLE, ...(galleryId ? { galleryId } : {}) },
      select: SELECT_TESTIMONIO,
      orderBy: ORDEN,
    });
    return filas.map((f) => mapTestimonio(f, this.storage));
  }

  async listarTodos(): Promise<AdminTestimonialDto[]> {
    const filas = await this.prisma.testimonial.findMany({
      select: SELECT_TESTIMONIO_ADMIN,
      orderBy: ORDEN,
    });
    return filas.map((f) => mapTestimonioAdmin(f, this.storage));
  }

  async crear(dto: CreateTestimonialDto): Promise<AdminTestimonialDto> {
    // Nace BORRADOR aunque llegue `isActive: true`: publicar exige pasar por la
    // misma puerta que una edición.
    this.asegurarConsentimiento(dto.isActive ?? false, dto.hasConsent ?? false);

    const { _max } = await this.prisma.testimonial.aggregate({ _max: { order: true } });

    const creado = await this.prisma.testimonial.create({
      data: {
        authorName: dto.authorName.trim(),
        format: dto.format ?? 'SCREENSHOT',
        source: dto.source ?? 'WHATSAPP',
        ...this.camposOpcionales(dto),
        hasConsent: dto.hasConsent ?? false,
        isActive: dto.isActive ?? false,
        order: (_max.order ?? -1) + 1,
      },
      select: { id: true },
    });

    if (dto.isFeatured) await this.destacar(creado.id);
    return this.porId(creado.id);
  }

  async actualizar(id: string, dto: UpdateTestimonialDto): Promise<AdminTestimonialDto> {
    const actual = await this.prisma.testimonial.findUnique({
      where: { id },
      select: { hasConsent: true, isActive: true },
    });
    if (!actual) throw new NotFoundException();

    // El estado RESULTANTE es lo que se comprueba: quitar el consentimiento a
    // uno ya publicado también tiene que rebotar.
    this.asegurarConsentimiento(
      dto.isActive ?? actual.isActive,
      dto.hasConsent ?? actual.hasConsent,
    );

    await this.prisma.testimonial.update({
      where: { id },
      data: {
        authorName: dto.authorName?.trim(),
        format: dto.format,
        source: dto.source,
        ...this.camposOpcionales(dto),
        hasConsent: dto.hasConsent,
        isActive: dto.isActive,
      },
    });

    if (dto.isFeatured === true) await this.destacar(id);
    return this.porId(id);
  }

  async destacar(id: string): Promise<AdminTestimonialDto> {
    await this.asegurarQueExiste(id);
    // Exclusivo GLOBAL, sin scope: uno destacado y el resto por orden.
    await this.exclusiveFlag.setOnly(this.prisma.testimonial, 'isFeatured', id);
    return this.porId(id);
  }

  /**
   * Borrado DURO, y se lleva la captura del bucket. No hay soft delete que
   * justificar aquí: una captura de WhatsApp con el nombre y la cara de una
   * clienta **no debe sobrevivir treinta días** a que James decida quitarla.
   */
  async borrar(id: string): Promise<void> {
    const testimonio = await this.prisma.testimonial.findUnique({
      where: { id },
      select: { screenshotKey: true, avatarKey: true },
    });
    if (!testimonio) throw new NotFoundException();

    await this.prisma.testimonial.delete({ where: { id } });

    // Después de borrar la fila: si el bucket falla, la fila ya no está y el
    // objeto queda huérfano — que es infinitamente mejor que lo contrario.
    for (const clave of [testimonio.screenshotKey, testimonio.avatarKey]) {
      if (clave) await this.storage.delete(clave).catch(() => undefined);
    }
  }

  reordenar(ids: string[]): Promise<AdminTestimonialDto[]> {
    return this.reorder.reorder(this.prisma.testimonial, ids).then(() => this.listarTodos());
  }

  // ---------------------------------------------------------------- privado

  /**
   * La puerta, en el SERVIDOR. El admin deshabilita el control, pero puede
   * equivocarse; la API no debe poder.
   */
  private asegurarConsentimiento(isActive: boolean, hasConsent: boolean): void {
    if (isActive && !hasConsent) {
      throw new UnprocessableEntityException({
        code: 'CONSENT_REQUIRED',
        message:
          'No se puede publicar un testimonio sin el consentimiento de quien lo escribió. ' +
          'Márcalo primero.',
      });
    }
  }

  private camposOpcionales(dto: CreateTestimonialDto | UpdateTestimonialDto) {
    return {
      authorHandle: textoLimpio(dto.authorHandle),
      avatarKey: textoLimpio(dto.avatarKey),
      eventType: textoLimpio(dto.eventType),
      eventDate: fechaDeCalendario(dto.eventDate),
      quote: textoLimpio(dto.quote),
      screenshotKey: textoLimpio(dto.screenshotKey),
      externalUrl: textoLimpio(dto.externalUrl),
      rating: dto.rating,
      galleryId: textoLimpio(dto.galleryId),
    };
  }

  private async porId(id: string): Promise<AdminTestimonialDto> {
    const fila = await this.prisma.testimonial.findUnique({
      where: { id },
      select: SELECT_TESTIMONIO_ADMIN,
    });
    if (!fila) throw new NotFoundException();
    return mapTestimonioAdmin(fila, this.storage);
  }

  private async asegurarQueExiste(id: string): Promise<void> {
    const existe = await this.prisma.testimonial.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException();
  }
}
