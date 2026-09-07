import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateGalleryDto } from './create-gallery.dto.js';

/** Siempre PartialType, nunca a mano: se desincroniza al agregar un campo (§5). */
export class UpdateGalleryDto extends PartialType(CreateGalleryDto) {
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  /**
   * Hay hoja de autorización de imagen firmada para este evento.
   *
   * Sin esto, `isPublished: true` se rechaza con 422 `CONSENT_REQUIRED`. Mismo
   * mecanismo que en los testimonios y por la misma razón: aquí salen caras de
   * gente real, y en los XV años, menores.
   */
  @IsOptional()
  @IsBoolean()
  hasConsent?: boolean;
}
