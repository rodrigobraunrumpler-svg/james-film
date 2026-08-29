import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ICONOS } from '../../../common/iconos.js';

export class CreateDifferentiatorDto {
  /** `@unique` en el schema: un título repetido devuelve 409 nombrando el campo. */
  @IsString()
  @Length(2, 80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subtitle?: string | null;

  @IsIn(ICONOS)
  icon!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDifferentiatorDto extends PartialType(CreateDifferentiatorDto) {}
