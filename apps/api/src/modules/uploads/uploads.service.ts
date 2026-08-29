import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PresignUploadResult } from '@james-film/contracts';
import { extensionDe } from '../media/media.rules.js';
import { StorageService } from '../../storage/storage.service.js';
import { PROPOSITOS } from './uploads.rules.js';
import type { PresignUploadDto } from './dto/presign-upload.dto.js';

/**
 * Firma una subida que **no** crea ninguna fila. La clave se guarda cuando el
 * `PATCH` de la entidad la incluye.
 *
 * Lo que eso deja abierto: si se sube y no se guarda, el objeto queda sin que
 * nada lo referencie. Lo recoge el cron de la fase 6 barriendo los prefijos de
 * `PREFIJOS_BARRIBLES` con más de 24 h — `videos/` y `posters/` quedan FUERA
 * de ese barrido, porque ahí vive el trabajo de James.
 */
@Injectable()
export class UploadsService {
  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async firmar(dto: PresignUploadDto): Promise<PresignUploadResult> {
    const regla = PROPOSITOS[dto.proposito];

    if (!regla.mimes.includes(dto.mimeType)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Este tipo de archivo no vale aquí. Usa ${nombresLegibles(regla.mimes)}.`,
      });
    }

    const techo = regla.maxBytes ?? this.config.getOrThrow<number>('MAX_IMAGE_MB') * 1024 * 1024;
    if (dto.sizeBytes > techo) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `El archivo pesa ${mb(dto.sizeBytes)} y el máximo aquí son ${mb(techo)}.`,
      });
    }

    // Nombre UUID, nunca el original: colisiones y path traversal. Y el prefijo
    // sale de la tabla, no del cliente.
    const key = `${regla.prefijo}/${randomUUID()}.${extensionDe(dto.mimeType)}`;

    return {
      key,
      uploadUrl: await this.storage.getUploadUrl({
        key,
        contentType: dto.mimeType,
        contentLength: dto.sizeBytes,
      }),
    };
  }
}

const mb = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.round(bytes / 1024)} KB`;

const nombresLegibles = (mimes: readonly string[]): string =>
  mimes.map((m) => m.split('/')[1].replace('svg+xml', 'SVG').toUpperCase()).join(', ');
