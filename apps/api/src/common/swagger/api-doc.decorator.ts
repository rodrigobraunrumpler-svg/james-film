import { applyDecorators, type Type } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiErrors, type CodigoError } from './api-errors.decorator.js';
import { ApiSuccessEntity, PaginationMetaEntity } from './envelope.entities.js';

export interface ApiDocOptions {
  summary: string;
  description?: string;
  /** Tipo dentro de `data`. Usa `paginated` si la respuesta es una lista. */
  ok?: Type<unknown>;
  paginated?: Type<unknown>;
  status?: number;
  /** Errores esperados de ESTE endpoint. El 401 lo añade `auth` solo. */
  errors?: CodigoError[];
  auth?: boolean;
}

/**
 * UN decorador por endpoint. El sobre se aplica aquí, en un solo sitio: sin esto
 * habría que tocar cada @ApiResponse del proyecto cada vez que cambie la forma
 * de la respuesta.
 */
export function ApiDoc(opts: ApiDocOptions): MethodDecorator {
  const modelos = [ApiSuccessEntity, PaginationMetaEntity, opts.ok, opts.paginated].filter(
    (m): m is Type<unknown> => m !== undefined,
  );

  const respuesta = opts.paginated
    ? {
        status: opts.status ?? 200,
        schema: {
          allOf: [
            { $ref: getSchemaPath(ApiSuccessEntity) },
            {
              properties: {
                data: { type: 'array', items: { $ref: getSchemaPath(opts.paginated) } },
                meta: { $ref: getSchemaPath(PaginationMetaEntity) },
              },
            },
          ],
        },
      }
    : opts.ok
      ? {
          status: opts.status ?? 200,
          schema: {
            allOf: [
              { $ref: getSchemaPath(ApiSuccessEntity) },
              { properties: { data: { $ref: getSchemaPath(opts.ok) } } },
            ],
          },
        }
      : { status: opts.status ?? 204, description: 'Sin contenido' };

  return applyDecorators(
    ApiOperation({ summary: opts.summary, description: opts.description }),
    ApiExtraModels(...modelos),
    ApiResponse(respuesta),
    ...(opts.auth ? [ApiBearerAuth()] : []),
    ApiErrors(...(opts.errors ?? []), ...(opts.auth ? ([401] as const) : [])),
  );
}
