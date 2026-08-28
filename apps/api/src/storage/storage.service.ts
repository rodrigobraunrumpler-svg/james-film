import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FirmaSubida {
  key: string;
  contentType: string;
  /** Va DENTRO de la firma. Sin él cualquiera sube 5 GB con tu credencial (§4). */
  contentLength: number;
  expiresIn?: number;
}

export interface MetadatosObjeto {
  contentLength: number;
  contentType: string | undefined;
}

/**
 * UN SOLO adaptador, no dos. §5 propone `r2.adapter` y `s3.adapter`, pero §17
 * admite que es el mismo `@aws-sdk/client-s3` cambiando el endpoint: serían el
 * mismo archivo dos veces. MinIO en local y CI, R2 en producción.
 */
@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly ttl: number;
  private readonly cdnBase: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.ttl = config.getOrThrow<number>('PRESIGN_TTL_SECONDS');
    this.cdnBase = config.getOrThrow<string>('CDN_BASE_URL').replace(/\/$/, '');

    this.s3 = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle: config.getOrThrow<boolean>('S3_FORCE_PATH_STYLE'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * URL para que el NAVEGADOR suba directo. Nunca pasa por la API: un vídeo de
   * 200 MB por el event loop obliga a escalar por un problema que no es tuyo (§4).
   */
  getUploadUrl(args: FirmaSubida): Promise<string> {
    const comando = new PutObjectCommand({
      Bucket: this.bucket,
      Key: args.key,
      ContentType: args.contentType,
      ContentLength: args.contentLength,
      // Nombre UUID e inmutable: el objeto nunca cambia bajo la misma clave.
      CacheControl: 'public, max-age=31536000, immutable',
    });

    // `signableHeaders` NO es opcional: por defecto el SDK firma solo
    // `content-length;host`, así que el tipo declarado no se aplicaría y
    // alguien con la URL podría subir text/html bajo una clave .mp4 — XSS
    // almacenado servido desde el CDN. Verificado inspeccionando la firma.
    return getSignedUrl(this.s3, comando, {
      expiresIn: args.expiresIn ?? this.ttl,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
  }

  /**
   * Lo usa el confirm: una subida truncada por pérdida de red devuelve un tamaño
   * distinto al declarado, y sin esta comprobación quedaría READY con un vídeo
   * roto que nadie descubre hasta que un visitante lo abre.
   */
  async headObject(key: string): Promise<MetadatosObjeto | null> {
    try {
      const r = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { contentLength: r.ContentLength ?? 0, contentType: r.ContentType };
    } catch (e) {
      if (e instanceof NotFound) return null;
      // S3 devuelve 403 en vez de 404 cuando no hay permiso de ListBucket.
      if (typeof e === 'object' && e !== null && '$metadata' in e) {
        const status = (e as { $metadata: { httpStatusCode?: number } }).$metadata.httpStatusCode;
        if (status === 404 || status === 403) return null;
      }
      throw e;
    }
  }

  /** Idempotente: el cron de huérfanos lo llama sobre objetos que quizá ya no están. */
  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Se construye desde CDN_BASE_URL, no desde el endpoint S3: es lo que permite
   * cambiar de proveedor sin migrar la base, porque se guarda la key y nunca la
   * URL (§17).
   */
  getPublicUrl(key: string): string {
    return `${this.cdnBase}/${key.replace(/^\//, '')}`;
  }
}
