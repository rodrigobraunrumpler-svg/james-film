import { ApiProperty } from '@nestjs/swagger';
import type { PresignUploadResult } from '@james-film/contracts';

export class PresignUploadEntity implements PresignUploadResult {
  @ApiProperty({
    example: 'covers/9f2c….jpg',
    description: 'Lo que se guarda en la columna `*Key`. NUNCA la URL.',
  })
  key!: string;

  @ApiProperty({ description: 'URL firmada para el PUT directo. Caduca.' })
  uploadUrl!: string;
}
