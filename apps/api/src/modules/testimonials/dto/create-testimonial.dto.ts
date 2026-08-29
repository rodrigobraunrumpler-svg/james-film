import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const FORMATOS = ['TEXT', 'SCREENSHOT'] as const;
const FUENTES = ['WHATSAPP', 'INSTAGRAM', 'TIKTOK', 'DIRECTO'] as const;

export class CreateTestimonialDto {
  @IsString()
  @Length(2, 80)
  authorName!: string;

  @IsOptional()
  @IsIn(FORMATOS)
  format?: (typeof FORMATOS)[number];

  @IsOptional()
  @IsIn(FUENTES)
  source?: (typeof FUENTES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  authorHandle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatarKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  eventType?: string | null;

  /** Fecha de calendario. `null` la BORRA; `undefined` la deja como está. */
  @IsOptional()
  @IsDateString()
  eventDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  quote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  screenshotKey?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  externalUrl?: string | null;

  /**
   * El schema lo declara `Int?` sin tope: un 7 sobre 5 entraría en la base y la
   * landing pintaría siete estrellas. No se pone un CHECK —con adapter-pg
   * saldría como un 500 opaco, ya lo comprobamos en la fase 1— se valida aquí,
   * que es donde el error sale legible.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  galleryId?: string | null;

  /**
   * La Ley 29733 en un booleano. Sin esto en `true`, el testimonio no puede
   * publicarse — y lo impide el servidor, no el formulario.
   */
  @IsOptional()
  @IsBoolean()
  hasConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
