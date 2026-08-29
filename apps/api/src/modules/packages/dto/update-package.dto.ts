import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { CreatePackageDto } from './create-package.dto.js';

export class UpdatePackageDto extends PartialType(CreatePackageDto) {
  /** Editable a mano; NO se regenera al renombrar. */
  @IsOptional()
  @IsString()
  @Length(2, 60)
  slug?: string;
}
