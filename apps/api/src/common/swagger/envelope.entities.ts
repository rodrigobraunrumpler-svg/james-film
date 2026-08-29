import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ApiFailure, ErrorCode, FieldError, PaginationMeta } from '@james-film/contracts';

/**
 * Clases, no interfaces: Swagger necesita algo con presencia en runtime para
 * referenciarlo. `implements` contra el contrato es lo que impide que se
 * desincronicen — si divergen, no compila.
 */
export class PaginationMetaEntity implements PaginationMeta {
  @ApiProperty({ example: 47 }) totalCount!: number;
  @ApiProperty({ example: 3 }) pageCount!: number;
  @ApiProperty({ example: 2 }) currentPage!: number;
  @ApiProperty({ example: 20 }) pageSize!: number;
  @ApiProperty() isFirstPage!: boolean;
  @ApiProperty() isLastPage!: boolean;
  @ApiProperty({ type: Number, nullable: true, example: 1 }) previousPage!: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 3 }) nextPage!: number | null;
}

export class ApiSuccessEntity {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'OK' }) code!: 'OK';
  @ApiProperty({ example: '2026-08-28T16:40:12.031Z' }) timestamp!: string;
}

/**
 * `packages/contracts` no emite runtime, así que el listado de códigos vive aquí.
 * El `Record<ErrorCode, true>` es lo que impide que se desincronicen: si añades
 * un código a la unión y olvidas este objeto, **no compila**.
 */
const TODOS_LOS_CODIGOS: Record<ErrorCode, true> = {
  VALIDATION_FAILED: true,
  UNAUTHORIZED: true,
  FORBIDDEN: true,
  NOT_FOUND: true,
  CONFLICT: true,
  RATE_LIMITED: true,
  INTERNAL: true,
  INVALID_CREDENTIALS: true,
  SESSION_EXPIRED: true,
  SESSION_REVOKED: true,
  SLUG_TAKEN: true,
  CATEGORY_IN_USE: true,
  CONSENT_REQUIRED: true,
  UNSUPPORTED_MEDIA_TYPE: true,
  FILE_TOO_LARGE: true,
  UPLOAD_SIZE_MISMATCH: true,
};

export const CODIGOS_ERROR = Object.keys(TODOS_LOS_CODIGOS) as ErrorCode[];

export class FieldErrorEntity implements FieldError {
  @ApiProperty({ example: 'items.0.text' }) field!: string;
  @ApiProperty({ example: 'isNotEmpty' }) code!: string;
  @ApiProperty({ example: 'No puede estar vacío' }) message!: string;
}

export class ApiFailureEntity implements ApiFailure {
  @ApiProperty({ example: false }) success!: false;
  @ApiProperty({ example: 409 }) statusCode!: number;
  // Enum explícito, no inferido: el plugin de Swagger solo corre en `nest build`,
  // así que dejar que infiera haría que el documento generado desde el código
  // fuente y el generado desde dist no coincidieran. Y de paso el contrato
  // publica la lista completa de códigos, que es justo lo que el cliente necesita.
  @ApiProperty({
    enum: CODIGOS_ERROR,
    example: 'SLUG_TAKEN',
    description: 'El contrato. El mensaje puede cambiar; esto no.',
  })
  code!: ErrorCode;
  @ApiProperty({ example: 'Ya existe una galería con ese enlace' }) message!: string;
  @ApiPropertyOptional({ type: [FieldErrorEntity], description: 'Solo en VALIDATION_FAILED' })
  details?: FieldError[];
  @ApiPropertyOptional({ example: '01JD4X…' }) requestId?: string;
  @ApiProperty() timestamp!: string;
}
