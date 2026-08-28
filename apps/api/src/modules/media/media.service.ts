import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaConfirmResult, PresignItemResult } from '@james-film/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import type { PresignItemDto } from './dto/presign.dto.js';
import {
  MIMES_FOTO,
  MIMES_POSTER,
  MIMES_VIDEO,
  esVideo,
  extensionDe,
  orientacionDe,
  prefijoDe,
} from './media.rules.js';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async presign(galleryId: string, items: PresignItemDto[]): Promise<PresignItemResult[]> {
    await this.asegurarGaleria(galleryId);
    // Se valida TODO el lote antes de firmar nada: si el tercero es inválido,
    // no queremos dos URLs vivas y una fila creada a medias.
    for (const item of items) this.validar(item);

    // Los medios nuevos van AL FINAL. Con `order @default(0)` se colarían entre los
    // primeros: ReorderService solo numera los ids que se le envían, así que tras un
    // reorden todo lo nuevo empata en 0 con el primero.
    // El aggregate va AQUÍ y no dentro de firmarUno: con Promise.all, los ocho leerían
    // el mismo máximo.
    const { _max } = await this.prisma.media.aggregate({
      where: { galleryId, deletedAt: null },
      _max: { order: true },
    });
    const base = (_max.order ?? -1) + 1;

    return Promise.all(items.map((item, i) => this.firmarUno(galleryId, item, base + i)));
  }

  async confirmar(id: string): Promise<MediaConfirmResult> {
    const media = await this.prisma.media.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        error: true,
        orientation: true,
        storageKey: true,
        posterKey: true,
        sizeBytes: true,
        width: true,
        height: true,
      },
    });
    if (!media) throw new NotFoundException();

    // Idempotente por construcción: si ya está resuelto se devuelve tal cual,
    // sin tabla de claves de idempotencia. Las redes móviles reintentan solas.
    if (media.status !== 'PENDING') {
      return {
        id: media.id,
        status: media.status,
        orientation: media.orientation,
        error: media.error,
      };
    }

    const objeto = await this.storage.headObject(media.storageKey);

    // Una subida truncada por pérdida de red deja un tamaño distinto al
    // declarado. Sin esta comprobación quedaría READY con un vídeo roto que
    // nadie descubre hasta que un visitante lo abre.
    const fallo = !objeto
      ? 'El archivo no llegó al almacenamiento. Vuelve a subirlo.'
      : objeto.contentLength !== media.sizeBytes
        ? `La subida quedó incompleta: llegaron ${objeto.contentLength} de ${media.sizeBytes} bytes. Vuelve a subirlo.`
        : null;

    if (fallo) {
      const actualizado = await this.prisma.media.update({
        where: { id },
        data: { status: 'FAILED', error: fallo, attempts: { increment: 1 } },
        select: { id: true, status: true, orientation: true, error: true },
      });
      return actualizado;
    }

    // El poster es opcional: si no llegó, se anula la key en vez de dejar el
    // DTO apuntando a un 404.
    const posterOk = media.posterKey ? await this.storage.headObject(media.posterKey) : null;

    return this.prisma.media.update({
      where: { id },
      data: {
        status: 'READY',
        error: null,
        orientation: orientacionDe(media.width, media.height),
        posterKey: media.posterKey && posterOk ? media.posterKey : null,
      },
      select: { id: true, status: true, orientation: true, error: true },
    });
  }

  async borrar(id: string): Promise<void> {
    const existe = await this.prisma.media.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException();

    // Soft delete: el archivo sigue en el bucket hasta que el cron lo purgue
    // a los 30 días. Borrar la fila dejaría el objeto huérfano para siempre.
    await this.prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ---------------------------------------------------------------- privado

  private validar(item: PresignItemDto): void {
    const video = esVideo(item.type);

    // El DTO valida cada campo por separado; esto valida su COHERENCIA. Un
    // PHOTO con video/mp4 pasaría las dos y crearía un Media que la landing
    // renderizaría como imagen.
    const permitidos: readonly string[] = video ? MIMES_VIDEO : MIMES_FOTO;
    if (!permitidos.includes(item.mimeType)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: video
          ? 'Los vídeos deben ser MP4 con H.264. Expórtalo así desde CapCut.'
          : 'Las fotos deben ser JPEG, PNG o WebP.',
      });
    }

    const maxMb = this.config.getOrThrow<number>(video ? 'MAX_VIDEO_MB' : 'MAX_IMAGE_MB');
    if (item.sizeBytes > maxMb * 1024 * 1024) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `El archivo supera los ${maxMb} MB. Expórtalo a 1080p desde CapCut.`,
      });
    }

    if (item.posterMimeType && !MIMES_POSTER.includes(item.posterMimeType as 'image/jpeg')) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'El poster debe ser JPEG.',
      });
    }
  }

  private async firmarUno(
    galleryId: string,
    item: PresignItemDto,
    order: number,
  ): Promise<PresignItemResult> {
    // Nombre UUID, nunca el original del usuario: evita colisiones y previene
    // path traversal (§17).
    const uuid = randomUUID();
    const storageKey = `${prefijoDe(item.type)}/${uuid}.${extensionDe(item.mimeType)}`;
    // La extensión y el content-type salen del mime DECLARADO, no de una constante:
    // hardcodear webp aquí era el segundo sitio donde el poster se rompía en Safari.
    const posterKey = item.posterMimeType
      ? `posters/${uuid}.${extensionDe(item.posterMimeType)}`
      : null;

    const media = await this.prisma.media.upsert({
      where: { galleryId_clientUploadId: { galleryId, clientUploadId: item.clientUploadId } },
      // Reenviar el mismo clientUploadId NO crea otra fila ni cambia la clave:
      // el archivo puede estar ya subido a la anterior.
      update: {},
      create: {
        galleryId,
        order,
        clientUploadId: item.clientUploadId,
        type: item.type,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        width: item.width,
        height: item.height,
        durationSec: item.durationSec,
        orientation: orientacionDe(item.width, item.height),
        storageKey,
        posterKey,
      },
      select: { id: true, storageKey: true, posterKey: true, sizeBytes: true, mimeType: true },
    });

    const [uploadUrl, posterUploadUrl] = await Promise.all([
      this.storage.getUploadUrl({
        key: media.storageKey,
        contentType: media.mimeType,
        contentLength: media.sizeBytes,
      }),
      media.posterKey && item.posterMimeType && item.posterSizeBytes
        ? this.storage.getUploadUrl({
            key: media.posterKey,
            contentType: item.posterMimeType,
            contentLength: item.posterSizeBytes,
          })
        : Promise.resolve(null),
    ]);

    return {
      mediaId: media.id,
      uploadUrl,
      posterUploadUrl,
      storageKey: media.storageKey,
      posterKey: media.posterKey,
    };
  }

  private async asegurarGaleria(id: string): Promise<void> {
    const existe = await this.prisma.gallery.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException();
  }
}
