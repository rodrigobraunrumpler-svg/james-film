import { ApiProperty } from '@nestjs/swagger';
import type {
  AttentionItemDto,
  AttentionKind,
  ClickDayDto,
  ClickStatsDto,
  DashboardDto,
  DeployStateDto,
  DeployStatus,
  CategoryClickShareDto,
  IsoDate,
  SaturdayCountDto,
  SourceClickShareDto,
  StorageUsageDto,
  WhatsappSource,
} from '@james-film/contracts';
import { ApiDoc } from '../../../common/swagger/api-doc.decorator.js';

export class AttentionItemEntity implements AttentionItemDto {
  @ApiProperty({ description: 'Estable entre cargas: es la clave del descarte en localStorage.' })
  id!: string;
  @ApiProperty({ enum: ['DEPLOY_FAILED', 'MEDIA_FAILED', 'STALE_DRAFT'] }) kind!: AttentionKind;
  @ApiProperty() title!: string;
  @ApiProperty() detail!: string;
  @ApiProperty({ example: '/galerias/clx…' }) href!: string;
  @ApiProperty({ example: 'Ver la galería' }) accion!: string;
  @ApiProperty({ type: String, nullable: true }) coverUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) galleryId!: string | null;
  @ApiProperty({ description: 'Se pinta en rojo. Solo el deploy fallido lo es.' })
  grave!: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'ISO. El admin lo formatea con Intl; la API no devuelve texto de interfaz.',
  })
  since!: string | null;
}

export class ClickDayEntity implements ClickDayDto {
  @ApiProperty({ example: '2026-08-29', description: 'Fecha de calendario, se formatea en UTC.' })
  date!: string;
  @ApiProperty() count!: number;
}

export class CategoryClickShareEntity implements CategoryClickShareDto {
  @ApiProperty() packageId!: string;
  @ApiProperty() packageName!: string;
  @ApiProperty() count!: number;
}

export class SaturdayCountEntity implements SaturdayCountDto {
  @ApiProperty({ example: '2026-09-01', description: 'El primer día del mes.' })
  month!: IsoDate;
  @ApiProperty() free!: number;
  @ApiProperty() total!: number;
}

export class SourceClickShareEntity implements SourceClickShareDto {
  @ApiProperty({ example: 'calendario-ocupado' }) source!: WhatsappSource;
  @ApiProperty() clicks!: number;
}

export class ClickStatsEntity implements ClickStatsDto {
  @ApiProperty() total!: number;
  @ApiProperty({ description: 'La ventana móvil anterior, no el mes de calendario.' })
  previousTotal!: number;
  @ApiProperty({ type: [ClickDayEntity], description: '30 días, con los ceros incluidos.' })
  daily!: ClickDayDto[];
  @ApiProperty({ type: [CategoryClickShareEntity] }) byPackage!: CategoryClickShareDto[];
  @ApiProperty({ description: 'Clics del hero o del pie, sin paquete.' }) noPackage!: number;
  @ApiProperty({
    type: [SourceClickShareEntity],
    description: 'De dónde salieron, de más a menos. Sin las fuentes que no tuvieron ninguno.',
  })
  bySource!: SourceClickShareDto[];
}

export class StorageUsageInlineEntity implements StorageUsageDto {
  @ApiProperty() usedBytes!: number;
  @ApiProperty() quotaBytes!: number;
}

export class DeployStateEntity implements DeployStateDto {
  @ApiProperty({ enum: ['IDLE', 'QUEUED', 'BUILDING', 'SUCCESS', 'FAILED'] })
  status!: DeployStatus;
  @ApiProperty() pendingChanges!: number;
  @ApiProperty({ type: String, nullable: true }) error!: string | null;
  @ApiProperty({ type: String, nullable: true }) finishedAt!: string | null;
}

export class UltimaGaleriaEntity {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
}

export class DashboardEntity implements DashboardDto {
  @ApiProperty({ type: [AttentionItemEntity] }) attention!: AttentionItemDto[];
  @ApiProperty({ type: ClickStatsEntity }) clicks!: ClickStatsDto;
  @ApiProperty({ type: StorageUsageInlineEntity }) storage!: StorageUsageDto;
  @ApiProperty({ type: DeployStateEntity }) deploy!: DeployStateDto;
  @ApiProperty({ type: UltimaGaleriaEntity, nullable: true })
  ultimaGaleria!: DashboardDto['ultimaGaleria'];
  @ApiProperty({
    type: [SaturdayCountEntity],
    description: 'Tres meses, contados desde HOY y no desde el día 1.',
  })
  saturdays!: SaturdayCountDto[];
}

export const DocPanel = (): MethodDecorator =>
  ApiDoc({
    summary: 'Todo lo que pinta el panel, en una sola petición',
    description:
      'Cinco consultas en paralelo en vez de cinco endpoints: la pantalla no puede ' +
      'pintarse a trozos —el bloque de avisos decide el alto de todo lo de abajo— y ' +
      'cinco peticiones darían cinco saltos de layout en la conexión de James.\n\n' +
      'Las ventanas son **móviles** (`ahora - 30 días`), no meses de calendario: así ' +
      'el número no depende de la zona horaria ni salta el día 1.',
    ok: DashboardEntity,
    auth: true,
  });
