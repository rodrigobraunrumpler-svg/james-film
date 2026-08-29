import { ApiProperty } from '@nestjs/swagger';
import { AdminMediaEntity } from '../../galleries/docs/galleries.entities.js';
import type {
  MediaConfirmResult,
  MediaStatus,
  Orientation,
  PresignItemResult,
  StorageUsageDto,
} from '@james-film/contracts';
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

export class StorageUsageEntity implements StorageUsageDto {
  @ApiProperty({ example: 3_435_973_836, description: 'Suma de los medios READY sin borrar.' })
  usedBytes!: number;
  @ApiProperty({ example: 10_737_418_240, description: 'STORAGE_QUOTA_GB en bytes.' })
  quotaBytes!: number;
}

export const DocUsoAlmacenamiento = (): MethodDecorator =>
  ApiDoc({
    summary: 'Cuánto ocupan los medios, para el medidor del sidebar',
    description:
      'Se suma sobre `Media`, no se pregunta a R2: el bucket guarda además portadas ' +
      'y logos —kilobytes— y un `ListObjectsV2` por cada carga del panel costaría ' +
      'más que el dato. Los borrados blandos no cuentan.',
    ok: StorageUsageEntity,
    auth: true,
  });

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

export const DocActualizarMedia = (): MethodDecorator =>
  ApiDoc({
    summary: 'Edita el texto alternativo y el pie de un medio',
    description:
      'Lo ÚNICO editable de un medio ya subido: el resto lo determina el archivo. El `alt` es ' +
      'accesibilidad de la landing — sin él un lector de pantalla anuncia «imagen» y ya.',
    ok: AdminMediaEntity,
    errors: [404],
    auth: true,
  });
