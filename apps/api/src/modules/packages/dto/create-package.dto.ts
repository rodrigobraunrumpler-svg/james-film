import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ICONOS } from '../../../common/iconos.js';
import { PackageItemInputDto } from './package-item.dto.js';

export class CreatePackageDto {
  @IsString()
  @Length(2, 60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subtitle?: string | null;

  /**
   * CÉNTIMOS y entero. En el admin se edita en soles enteros, pero `step="1"`
   * no valida nada —el navegador acepta un 300.5 escrito a mano y aquí no hay
   * submit nativo—, así que la última palabra la tiene esto.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  priceAmount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  priceNote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idealFor?: string | null;

  /** Lista cerrada: un typo deja un hueco en la web y nadie lo ve venir. */
  @IsOptional()
  @IsIn(ICONOS)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  accentColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  badgeText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  whatsappMessage?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Exclusivo: marcarlo desmarca el resto, forzado en el servicio. */
  @IsOptional()
  @IsBoolean()
  isHighlighted?: boolean;

  /**
   * El array COMPLETO y en orden. Con endpoints por bullet, guardar sería una
   * ráfaga de seis peticiones que puede fallar a medias y dejar el paquete en
   * un estado que nadie pidió.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PackageItemInputDto)
  items?: PackageItemInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  categoryIds?: string[];
}
