import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { IsoDate, SetAvailabilityInput } from '@james-film/contracts';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SetAvailabilityDto implements SetAvailabilityInput {
  /**
   * `@ArrayMaxSize(366)` **no es cosmético**: sin techo, un `PUT` con cien mil
   * fechas es una denegación de servicio gratis. Misma razón que el máximo de
   * longitud del `LoginDto`.
   */
  @ApiProperty({ type: [String], example: ['2026-10-24', '2026-10-25'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(366)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true, message: 'cada fecha va en formato YYYY-MM-DD' })
  dates!: IsoDate[];

  @ApiProperty({ description: 'true marca como ocupado, false desmarca' })
  @IsBoolean()
  busy!: boolean;

  /** Es una nota, no una descripción. Y **nunca sale al público**. */
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}
