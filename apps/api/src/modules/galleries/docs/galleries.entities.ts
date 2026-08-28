import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CategoryRefDto,
  GalleryDto,
  GalleryListItemDto,
  MediaDto,
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
