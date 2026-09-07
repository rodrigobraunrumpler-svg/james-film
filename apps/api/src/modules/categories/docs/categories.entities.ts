import { ApiProperty } from '@nestjs/swagger';
import type {
  AdminCategoryDto,
  CategoryClickShareDto,
  CategoryDto,
} from '@james-film/contracts';

export class CategoryEntity implements CategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'bodas' }) slug!: string;
  @ApiProperty({ example: 'Bodas' }) name!: string;
  @ApiProperty({ type: String, nullable: true }) tagline!: string | null;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, nullable: true }) coverUrl!: string | null;
}

export class CategoryClickShareEntity implements CategoryClickShareDto {
  @ApiProperty() packageId!: string;
  @ApiProperty({ example: 'Pro' }) packageName!: string;
  @ApiProperty() count!: number;
}

export class AdminCategoryEntity extends CategoryEntity implements AdminCategoryDto {
  @ApiProperty({ description: 'false = la landing no la ve.' }) isActive!: boolean;
  @ApiProperty() order!: number;
  @ApiProperty({ type: String, nullable: true }) metaTitle!: string | null;
  @ApiProperty({ type: String, nullable: true }) metaDescription!: string | null;
  @ApiProperty({ description: 'Cuántas galerías la usan. Impide borrarla.' })
  galleryCount!: number;
  @ApiProperty({ description: 'Cuántos paquetes la usan. El borrado los desvincularía.' })
  packageCount!: number;
  @ApiProperty({
    type: [String],
    description:
      'Las portadas de sus tres galerías publicadas más recientes. La tarjeta enseña ' +
      'qué hay dentro en vez de solo el nombre.',
  })
  recentCoverUrls!: string[];
  @ApiProperty({
    type: [CategoryClickShareEntity],
    description: 'A qué paquete van sus clics, derivado por `PackageCategory`.',
  })
  clickMix!: CategoryClickShareDto[];
  @ApiProperty({ description: 'La suma de `clickMix`. Cero es legítimo.' })
  clickTotal!: number;
}
