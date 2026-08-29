import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto.js';

/** Siempre PartialType, nunca a mano: se desincroniza al añadir un campo (§5). */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  /**
   * El slug se edita a mano y NO se regenera al renombrar: James comparte
   * enlaces y regenerarlo los rompe todos en silencio.
   */
  @IsOptional()
  @IsString()
  @Length(2, 60)
  slug?: string;
}
