import { ApiProperty } from '@nestjs/swagger';
import type {
  AdminDifferentiatorDto,
  AdminSocialLinkDto,
  DifferentiatorDto,
  SiteSettingsDto,
  SocialLinkDto,
} from '@james-film/contracts';

export class SiteSettingsEntity implements SiteSettingsDto {
  @ApiProperty({ example: 'James Film' }) brandName!: string;
  @ApiProperty({ type: String, nullable: true }) role!: string | null;
  @ApiProperty({ type: String, nullable: true }) tagline!: string | null;
  @ApiProperty({ type: String, nullable: true }) slogan!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Markdown con SOLO negrita. Se renderiza en build time.',
  })
  aboutText!: string | null;
  /** La CARA de James, no el logo: ése es una tira de película. */
  @ApiProperty({ type: String, nullable: true }) photoUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) logoUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) signatureUrl!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '51994724944',
    description: 'Internacional SIN el «+», listo para wa.me/.',
  })
  whatsappNumber!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '994 724 944' })
  whatsappDisplay!: string | null;
  @ApiProperty({ type: String, nullable: true }) whatsappMessage!: string | null;
  @ApiProperty({ type: String, nullable: true }) ctaText!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, nullable: true }) heroMediaUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) heroPosterUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) footerTagline!: string | null;
  @ApiProperty({ type: String, nullable: true }) metaTitle!: string | null;
  @ApiProperty({ type: String, nullable: true }) metaDescription!: string | null;
  @ApiProperty({ type: String, nullable: true }) ogImageUrl!: string | null;
}

export class DifferentiatorEntity implements DifferentiatorDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'ENTREGA RÁPIDA' }) title!: string;
  @ApiProperty({ type: String, nullable: true }) subtitle!: string | null;
  @ApiProperty({ description: 'Nombre lucide de la lista cerrada.' }) icon!: string;
}

export class AdminDifferentiatorEntity
  extends DifferentiatorEntity
  implements AdminDifferentiatorDto
{
  @ApiProperty() isActive!: boolean;
  @ApiProperty() order!: number;
}

export class SocialLinkEntity implements SocialLinkDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'instagram' }) platform!: string;
  @ApiProperty({ example: 'James_film30' }) handle!: string;
  @ApiProperty({ description: 'URL completa; no se arma desde el handle.' }) url!: string;
  @ApiProperty({ type: String, nullable: true }) icon!: string | null;
}

export class AdminSocialLinkEntity extends SocialLinkEntity implements AdminSocialLinkDto {
  @ApiProperty() isActive!: boolean;
  @ApiProperty() order!: number;
}
