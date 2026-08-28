import { UnprocessableEntityException } from '@nestjs/common';
import type { FieldError } from '@james-film/contracts';
import type { ValidationError } from 'class-validator';

/**
 * Aplana los ValidationError anidados a rutas con puntos: `items.0.text`.
 *
 * Sin esto, class-validator devuelve `message: ["title must be longer than..."]`
 * y el admin tendría que parsear inglés para atar el error a un campo. Con la
 * ruta, puede llamar a `setError(field, { message })` de react-hook-form directo.
 */
function aplanar(errores: ValidationError[], prefijo = ''): FieldError[] {
  return errores.flatMap((e) => {
    const ruta = prefijo ? `${prefijo}.${e.property}` : e.property;

    const propios: FieldError[] = Object.entries(e.constraints ?? {}).map(([code, message]) => ({
      field: ruta,
      code,
      message,
    }));

    const hijos = e.children?.length ? aplanar(e.children, ruta) : [];
    return [...propios, ...hijos];
  });
}

export function validationExceptionFactory(
  errores: ValidationError[],
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'VALIDATION_FAILED',
    message: 'Revisa los campos marcados',
    details: aplanar(errores),
  });
}
