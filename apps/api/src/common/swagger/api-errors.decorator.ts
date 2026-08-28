import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiFailureEntity } from './envelope.entities.js';

export type CodigoError = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429;

/**
 * El catálogo vive en UN sitio, junto al AllExceptionsFilter que produce estos
 * mismos mensajes. Repetir la cadena por endpoint es cómo se desincronizan.
 */
const CATALOGO: Record<CodigoError, string> = {
  400: 'Petición inválida o referencia inexistente',
  401: 'Falta el token o ya no es válido',
  403: 'El rol no permite esta operación',
  404: 'No encontrado',
  409: 'Ya existe un registro con ese valor único',
  413: 'La petición supera el tamaño permitido',
  422: 'La validación del DTO falló. Mira `details` para el campo concreto.',
  429: 'Demasiadas peticiones',
};

export const ApiErrors = (...codigos: CodigoError[]): MethodDecorator =>
  applyDecorators(
    ...[...new Set(codigos)].map((c) =>
      ApiResponse({ status: c, description: CATALOGO[c], type: ApiFailureEntity }),
    ),
  );
