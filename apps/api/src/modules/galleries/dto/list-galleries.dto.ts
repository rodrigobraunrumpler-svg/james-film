import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

/** Lista cerrada: el cliente manda una palabra, no un booleano crudo. */
export const ESTADOS_GALERIA = ['todas', 'publicadas', 'borradores'] as const;
export type EstadoGaleria = (typeof ESTADOS_GALERIA)[number];

export class ListGalleriesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ESTADOS_GALERIA, default: 'todas' })
  @IsOptional()
  @IsIn(ESTADOS_GALERIA)
  estado: EstadoGaleria = 'todas';

  /**
   * Búsqueda por título. Se recorta y una cadena vacía pasa a `undefined`: si no,
   * `?q=` con el campo vacío filtraría por `contains: ''` — que casa con todo,
   * pero deja el índice fuera y convierte cada tecleo en un scan inútil.
   * El techo de 100 evita un `LIKE` sobre una cadena de un megabyte.
   */
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Busca en el título, sin distinguir mayúsculas',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(100)
  q?: string;
}
