import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { MIMES_FOTO, MIMES_POSTER, MIMES_VIDEO } from '../media.rules.js';

const MIMES = [...MIMES_VIDEO, ...MIMES_FOTO];

export class PresignItemDto {
  @IsString()
  @Length(1, 255)
  filename!: string;

  @IsIn(MIMES)
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsIn(['REEL', 'AFTERMOVIE', 'PHOTO'])
  type!: 'REEL' | 'AFTERMOVIE' | 'PHOTO';

  /** Idempotencia sin tabla de claves: @@unique([galleryId, clientUploadId]). */
  @IsString()
  @Length(8, 64)
  clientUploadId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;

  @IsOptional()
  @IsIn(MIMES_POSTER)
  posterMimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  posterSizeBytes?: number;
}

export class PresignDto {
  /**
   * Ocho reels son UN roundtrip, no ocho (§10). El techo evita que alguien pida
   * mil firmas de golpe.
   */
  @IsArrayOfItems()
  items!: PresignItemDto[];
}

function IsArrayOfItems(): PropertyDecorator {
  return (target, key) => {
    ArrayNotEmpty()(target, key);
    ArrayMaxSize(50)(target, key);
    ValidateNested({ each: true })(target, key);
    Type(() => PresignItemDto)(target, key);
  };
}
