import { ApiProperty } from '@nestjs/swagger';
import type {
  AdminPackageDto,
  AdminPackageItemDto,
  PackageDto,
  PackageItemDto,
} from '@james-film/contracts';

export class PackageItemEntity implements PackageItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: '7 reels editados' }) text!: string;
  @ApiProperty({ description: 'false = se muestra tachado.' }) included!: boolean;
}

export class PackageEntity implements PackageDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'pro' }) slug!: string;
  @ApiProperty({ example: 'Pro' }) name!: string;
  @ApiProperty({ type: String, nullable: true }) subtitle!: string | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 30000,
    description: 'CÉNTIMOS. S/ 300 son 30000. Formatear con Intl.NumberFormat.',
  })
  priceAmount!: number | null;
  @ApiProperty({ example: 'PEN' }) currency!: string;
  @ApiProperty({ type: String, nullable: true }) priceNote!: string | null;
  @ApiProperty({ type: String, nullable: true }) idealFor!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Nombre lucide de lista cerrada.' })
  icon!: string | null;
  @ApiProperty({ type: String, nullable: true }) imageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) badgeText!: string | null;
  @ApiProperty({ type: String, nullable: true }) whatsappMessage!: string | null;
  @ApiProperty({ description: 'Solo uno puede estar en true. Lo fuerza la API.' })
  isHighlighted!: boolean;
  @ApiProperty({ type: [PackageItemEntity] }) items!: PackageItemDto[];
}

export class AdminPackageItemEntity extends PackageItemEntity implements AdminPackageItemDto {
  @ApiProperty() order!: number;
}

export class AdminPackageEntity extends PackageEntity implements AdminPackageDto {
  @ApiProperty({ type: [AdminPackageItemEntity] }) declare items: AdminPackageItemDto[];
  @ApiProperty() isActive!: boolean;
  @ApiProperty() order!: number;
  @ApiProperty({ type: String, nullable: true }) accentColor!: string | null;
  @ApiProperty({ type: [String] }) categoryIds!: string[];
  @ApiProperty({ description: 'Clics atribuidos. Con >0, borrar los perdería.' })
  whatsappClickCount!: number;
}
