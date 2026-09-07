import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiFailure, ErrorCode, FieldError } from '@james-film/contracts';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * UN SOLO filtro para todo. Con uno por tipo de error, cualquiera no contemplado
 * se escapa sin `code` y el cliente recibe una forma que no espera.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /**
   * Mapa estático por código. NUNCA leer `err.meta.target`: en Prisma 7 con driver
   * adapter no existe (`meta = { driverAdapterError, table, modelName }`) y leerlo
   * lanza un TypeError que convertiría el 409 en un 500.
   */
  private readonly prismaMap: Record<string, [number, ErrorCode, string]> = {
    P2002: [409, 'CONFLICT', 'Ya existe un registro con ese valor único'],
    P2025: [404, 'NOT_FOUND', 'No encontrado'],
    P2003: [400, 'CONFLICT', 'Referencia inválida'],
    /**
     * La base no responde. **503, no 500**: no es que algo haya reventado
     * dentro, es que no hay con quién hablar — y la diferencia decide qué hace
     * el cliente. Un 500 dice «error interno» y no sugiere reintentar; un 503
     * es explícitamente temporal.
     *
     * No es hipotético en ninguno de los dos entornos: en local es Docker
     * cerrado, y en producción es el **arranque en frío de Neon**, que es el
     * único cuello real que tiene este proyecto. Con «Error interno» la primera
     * visita del día parecía un fallo de código.
     */
    P1001: [503, 'INTERNAL', 'La base de datos no responde. Vuelve a intentarlo en unos segundos.'],
    /** Se agotó el tiempo abriendo la conexión. Mismo caso, mismo consejo. */
    P1002: [503, 'INTERNAL', 'La base de datos tardó demasiado. Vuelve a intentarlo.'],
    /** Sin conexiones libres en el pool: temporal por definición. */
    P2024: [503, 'INTERNAL', 'El servidor está saturado. Vuelve a intentarlo en unos segundos.'],
  };

  private readonly httpMap: Record<number, ErrorCode> = {
    400: 'VALIDATION_FAILED',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_FAILED',
    429: 'RATE_LIMITED',
  };

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();

    const cuerpo = this.normalizar(exception);
    const failure: ApiFailure = {
      success: false,
      ...cuerpo,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    };

    if (failure.statusCode >= 500) {
      // El detalle va al log con el requestId, nunca al cliente.
      this.logger.error(`[${failure.requestId ?? '-'}] ${req.method} ${req.url}`, exception);
    }

    res.status(failure.statusCode).json(failure);
  }

  private normalizar(e: unknown): Pick<ApiFailure, 'statusCode' | 'code' | 'message' | 'details'> {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      const [statusCode, code, message] = this.prismaMap[e.code] ?? [
        500,
        'INTERNAL' as const,
        'Error interno',
      ];
      return { statusCode, code, message };
    }

    if (e instanceof HttpException) {
      const statusCode = e.getStatus();
      const respuesta = e.getResponse();

      // El exceptionFactory del ValidationPipe ya produce { code, message, details }.
      if (typeof respuesta === 'object' && respuesta !== null && 'code' in respuesta) {
        const r = respuesta as { code: ErrorCode; message: string; details?: FieldError[] };
        return { statusCode, code: r.code, message: r.message, details: r.details };
      }

      const mensaje =
        typeof respuesta === 'string'
          ? respuesta
          : ((respuesta as { message?: string | string[] }).message ?? e.message);

      return {
        statusCode,
        code: this.httpMap[statusCode] ?? 'INTERNAL',
        message: Array.isArray(mensaje) ? mensaje.join('. ') : mensaje,
      };
    }

    // body-parser y otros middlewares de express lanzan errores con `status`
    // numérico que NO son HttpException. Sin esta rama, superar el límite de
    // cuerpo devolvería un 500 opaco en vez de un 413 con su código.
    if (typeof e === 'object' && e !== null && 'status' in e) {
      const status = Number((e as { status: unknown }).status);
      if (Number.isInteger(status) && status >= 400 && status < 500) {
        if (status === 413) {
          return {
            statusCode: 413,
            code: 'FILE_TOO_LARGE',
            message: 'La petición supera el tamaño permitido',
          };
        }
        return {
          statusCode: status,
          code: this.httpMap[status] ?? 'INTERNAL',
          message: 'Petición inválida',
        };
      }
    }

    // Lo desconocido nunca filtra su mensaje: podría llevar SQL o rutas del servidor.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL',
      message: 'Error interno',
    };
  }
}
