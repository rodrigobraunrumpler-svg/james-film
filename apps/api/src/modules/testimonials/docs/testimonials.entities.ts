import { ApiProperty } from '@nestjs/swagger';
import type {
  AdminTestimonialDto,
  TestimonialDto,
  TestimonialFormat,
  TestimonialSource,
} from '@james-film/contracts';

export class TestimonialEntity implements TestimonialDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['TEXT', 'SCREENSHOT'] }) format!: TestimonialFormat;
  @ApiProperty({ enum: ['WHATSAPP', 'INSTAGRAM', 'TIKTOK', 'DIRECTO'] }) source!: TestimonialSource;
  @ApiProperty() authorName!: string;
  @ApiProperty({ type: String, nullable: true }) authorHandle!: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) eventType!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-03-15',
    description: 'Fecha de calendario. Formatear con timeZone UTC.',
  })
  eventDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) quote!: string | null;
  @ApiProperty({ type: String, nullable: true }) screenshotUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) externalUrl!: string | null;
  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 5 }) rating!: number | null;
  @ApiProperty({ type: String, nullable: true }) galleryId!: string | null;
}

export class AdminTestimonialEntity extends TestimonialEntity implements AdminTestimonialDto {
  @ApiProperty({ description: 'Ley 29733: sin esto no se puede publicar.' }) hasConsent!: boolean;
  @ApiProperty({ description: 'Nace en false. Publicar exige hasConsent.' }) isActive!: boolean;
  @ApiProperty({ description: 'Exclusivo: uno solo.' }) isFeatured!: boolean;
  @ApiProperty() order!: number;
}
