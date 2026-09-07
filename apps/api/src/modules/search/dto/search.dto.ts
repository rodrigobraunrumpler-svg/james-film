import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SearchQueryDto {
  /**
   * Mínimo dos caracteres: con uno, «a» casa con casi todo y la consulta se
   * convierte en un scan de las cuatro tablas por cada tecla. El recorte va
   * antes de validar para que « a » no pase como si midiera tres.
   */
  @ApiProperty({ example: 'cami', minLength: 2, maxLength: 60 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  q!: string;
}
