import { ApiProperty } from '@nestjs/swagger';
import type { MediaConfirmResult, MediaStatus, Orientation, PresignItemResult } from '@james-film/contracts';
import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';

export class PresignItemResultEntity implements PresignItemResult {
  @ApiProperty() mediaId!: string;
  @ApiProperty({ description: 'PUT directo a esta URL. Nunca a través de la API.' })
  uploadUrl!: string;
  @ApiProperty({ type: String, nullable: true }) posterUploadUrl!: string | null;
  @ApiProperty({ example: 'videos/6f1c…-a2.mp4' }) storageKey!: string;
  @ApiProperty({ type: String, nullable: true }) posterKey!: string | null;
}

export class MediaConfirmResultEntity implements MediaConfirmResult {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['PENDING', 'READY', 'FAILED'] }) status!: MediaStatus;
  @ApiProperty({ enum: ['VERTICAL', 'HORIZONTAL', 'SQUARE'] }) orientation!: Orientation;
  @ApiProperty({ type: String, nullable: true, description: 'Qué falló, en castellano.' })
  error!: string | null;
}

export const DocPresign = (): MethodDecorator =>
  ApiDoc({
    summary: 'Firma la subida de N archivos en un solo roundtrip',
    description:
      'Valida mime, tamaño y la **coherencia entre `type` y `mimeType`** antes de firmar: ' +
      'firmar primero y validar después dejaría una URL válida en manos de quien mandó ' +
      'basura. El lote se valida entero antes de firmar nada.\n\n' +
      'Es **idempotente por `clientUploadId`**: reenviar el mismo devuelve el mismo ' +
      '`mediaId`, no uno nuevo. Las redes móviles reintentan solas.',
    ok: PresignItemResultEntity,
    status: 201,
    errors: [400, 404, 422],
    auth: true,
  });

export const DocConfirmar = (): MethodDecorator =>
  ApiDoc({
    summary: 'Confirma una subida y verifica que llegó entera',
    description:
      'Hace un `HEAD` contra el bucket y compara el tamaño con el declarado. Una subida ' +
      'truncada por pérdida de red devuelve 200 en el `PUT` y quedaría READY con un vídeo ' +
      'roto: aquí pasa a **FAILED con el motivo**.\n\n' +
      'Idempotente: si ya está resuelto se devuelve tal cual.',
    ok: MediaConfirmResultEntity,
    errors: [404],
    auth: true,
  });

export const DocBorrarMedia = (): MethodDecorator =>
  ApiDoc({
    summary: 'Borra un medio (soft delete)',
    status: 204,
    errors: [404],
    auth: true,
  });
