import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import { ICONOS } from '../../../common/iconos.js';

export class CreateSocialLinkDto {
  /** `@unique`: String y no enum, para que una red nueva no migre la base. */
  @IsString()
  @Length(2, 40)
  platform!: string;

  @IsString()
  @Length(1, 80)
  handle!: string;

  /** Completa, no se arma desde el handle: cada red tiene su formato. */
  @IsUrl()
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsIn(ICONOS)
  icon?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSocialLinkDto extends PartialType(CreateSocialLinkDto) {}
