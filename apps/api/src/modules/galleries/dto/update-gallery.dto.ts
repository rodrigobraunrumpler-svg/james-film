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
}
