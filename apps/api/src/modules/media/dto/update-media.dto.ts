import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Lo único editable de un medio ya subido. El resto —tipo, tamaño, clave,
 * dimensiones— lo determina el archivo, no una persona: dejar tocarlo sería
 * permitir que la fila contradiga al objeto del bucket.
 */
export class UpdateMediaDto {
  /**
   * Texto alternativo. Es accesibilidad de la landing, no un adorno: sin él,
   * un lector de pantalla anuncia «imagen» y ya.
   */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  alt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string | null;
}
