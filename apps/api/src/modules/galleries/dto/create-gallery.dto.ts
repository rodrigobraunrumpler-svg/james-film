import { IsDateString, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateGalleryDto {
  @IsString()
  @Length(2, 120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsString()
  @Length(1, 40)
  categoryId!: string;

  /**
   * Fecha de calendario, no instante: `YYYY-MM-DD`. Se guarda con @db.Date.
   * `null` la BORRA; `undefined` la deja como está. La distinción importa: el
   * editor manda el formulario entero en cada autoguardado.
   */
  @IsOptional()
  @IsDateString()
  eventDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string | null;
}
