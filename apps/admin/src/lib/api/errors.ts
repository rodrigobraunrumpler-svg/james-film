import type { ApiFailure, ErrorCode, FieldError } from '@james-film/contracts';

/**
 * Un `throw new Error('algo falló')` obliga a parsear cadenas en el componente.
 * Con el error tipado, la UI hace `switch (error.code)`.
 *
 * El `code` es el contrato; el `message` es para humanos y puede reescribirse sin
 * romper a nadie.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: FieldError[];

  constructor(
    readonly status: number,
    cuerpo?: ApiFailure,
    mensajeAlternativo?: string,
  ) {
    super(cuerpo?.message ?? mensajeAlternativo ?? `Error ${status}`);
    this.name = 'ApiError';
    this.code = cuerpo?.code ?? 'INTERNAL';
    this.details = cuerpo?.details;
  }

  /** 409: slug duplicado, testimonio sin consentimiento… */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** 400/422: el DTO no pasó. `details` trae el campo concreto. */
  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** 5xx o red caída: reintentar tiene sentido. Un 404 o un 422, no. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 0;
  }

  /**
   * La pasarela ya intentó refrescar. Si llega esto, la sesión murió y hay que
   * volver al login. `SESSION_REVOKED` además merece su propio mensaje: es lo que
   * pasa cuando la rotación detecta reuso del refresh.
   */
  get esSesionMuerta(): boolean {
    return (
      this.status === 401 || this.code === 'SESSION_EXPIRED' || this.code === 'SESSION_REVOKED'
    );
  }
}

export class NetworkError extends ApiError {
  constructor(readonly causa: unknown) {
    super(0, undefined, 'No hay conexión con el servidor');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor() {
    super(0, undefined, 'El servidor tardó demasiado en responder');
    this.name = 'TimeoutError';
  }
}

export const esApiError = (e: unknown): e is ApiError => e instanceof ApiError;
