import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(2, 60)
  name!: string;

  /** `null` BORRA, `undefined` NO TOCA. @IsOptional ya deja pasar null. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  /** La KEY que devolvió el presign, nunca una URL. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  coverKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
