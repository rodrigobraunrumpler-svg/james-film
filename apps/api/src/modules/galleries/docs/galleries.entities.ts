import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  AdminGalleryListItemDto,
  AdminMediaDto,
  CategoryRefDto,
  GalleryCountsDto,
  GalleryDto,
  GalleryListItemDto,
  MediaDto,
  MediaStatus,
  MediaType,
  Orientation,
} from '@james-film/contracts';

export class CategoryRefEntity implements CategoryRefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'bodas' }) slug!: string;
  @ApiProperty({ example: 'Bodas' }) name!: string;
}

export class MediaEntity implements MediaDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['REEL', 'AFTERMOVIE', 'PHOTO'] }) type!: MediaType;
  @ApiProperty({ enum: ['VERTICAL', 'HORIZONTAL', 'SQUARE'] }) orientation!: Orientation;
  @ApiProperty({ description: 'URL absoluta. En la base se guarda la key, nunca esto.' })
  url!: string;
  @ApiProperty({ type: String, nullable: true }) posterUrl!: string | null;
  @ApiProperty({ type: Number, nullable: true, example: 1080 }) width!: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 1920 }) height!: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 45 }) durationSec!: number | null;
  @ApiProperty({ type: String, nullable: true }) alt!: string | null;
  @ApiProperty({ type: String, nullable: true }) caption!: string | null;
  @ApiProperty() order!: number;
  @ApiProperty({ description: 'La portada. Exclusiva por galería.' }) isFeatured!: boolean;
}

/** Lo que ve el admin de un medio: el estado de subida y el porqué del fallo. */
export class AdminMediaEntity extends MediaEntity implements AdminMediaDto {
  @ApiProperty({ enum: ['PENDING', 'READY', 'FAILED'] }) status!: MediaStatus;
  @ApiProperty({ type: String, nullable: true, description: 'Qué falló, en castellano.' })
  error!: string | null;
}

export class GalleryEntity implements GalleryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'xv-de-camila' }) slug!: string;
  @ApiProperty({ example: 'XV de Camila' }) title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-03-15',
    description: 'Fecha de calendario, sin hora. Formatear con timeZone UTC.',
  })
  eventDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) location!: string | null;
  @ApiProperty({ type: String, nullable: true }) coverUrl!: string | null;
  @ApiProperty() isFeatured!: boolean;
  @ApiProperty({ type: CategoryRefEntity }) category!: CategoryRefDto;
  @ApiProperty({ type: [MediaEntity] }) media!: MediaDto[];
}

export class GalleryListItemEntity implements GalleryListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true, example: '2026-03-15' }) eventDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) location!: string | null;
  @ApiProperty({ type: String, nullable: true }) coverUrl!: string | null;
  @ApiProperty() isFeatured!: boolean;
  @ApiProperty({ type: CategoryRefEntity }) category!: CategoryRefDto;
  @ApiPropertyOptional({
    description: 'La lista NO trae los medios: solo cuántos hay listos.',
    example: 3,
  })
  mediaCount!: number;
}

/** Lo que ve el admin: añade el estado de publicación al item de la lista. */
export class AdminGalleryListItemEntity
  extends GalleryListItemEntity
  implements AdminGalleryListItemDto
{
  @ApiProperty({ description: 'false = borrador. La landing no lo ve.' })
  isPublished!: boolean;

  @ApiProperty({
    example: '2026-08-29T02:14:00.000Z',
    description: 'Último cambio. Se muestra como «hace 3 días», en America/Lima.',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    enum: ['REEL', 'AFTERMOVIE', 'PHOTO'],
    nullable: true,
    description: 'Tipo del medio destacado. null si la galería aún no tiene portada.',
  })
  coverType!: MediaType | null;

  @ApiPropertyOptional({ nullable: true, example: 72, description: 'Duración de la portada.' })
  coverDurationSec!: number | null;
}

export class GalleryCountsEntity implements GalleryCountsDto {
  @ApiProperty({ example: 14 }) todas!: number;
  @ApiProperty({ example: 11 }) publicadas!: number;
  @ApiProperty({ example: 3 }) borradores!: number;
}
