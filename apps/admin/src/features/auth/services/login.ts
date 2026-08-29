import type { ApiFailure } from '@james-film/contracts';
import type { DatosLogin } from '../schemas/login-schema';

export class ErrorLogin extends Error {
  constructor(
    readonly code: ApiFailure['code'],
    mensaje: string,
    /** Segundos que faltan, de la cabecera `Retry-After`. Solo en RATE_LIMITED. */
    readonly esperaSegundos?: number,
  ) {
    super(mensaje);
    this.name = 'ErrorLogin';
  }
}

/**
 * Llama al Route Handler del propio admin, no a la API: los tokens tienen que
 * quedarse en el servidor. Aquí solo vuelve un `ok`.
 */
export async function iniciarSesion(datos: DatosLogin): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(datos),
  });

  if (res.ok) return;

  const cuerpo = (await res.json().catch(() => undefined)) as ApiFailure | undefined;
  // `Retry-After` puede venir en segundos o como fecha HTTP; el throttler de
  // Nest manda segundos. Se acepta solo el número: una fecha mal parseada daría
  // una cuenta atrás absurda, y sin dato la interfaz ya sabe callar.
  const cabecera = Number(res.headers.get('retry-after'));
  const espera = Number.isFinite(cabecera) && cabecera > 0 ? Math.ceil(cabecera) : undefined;

  throw new ErrorLogin(
    cuerpo?.code ?? 'INTERNAL',
    cuerpo?.message ?? 'No se pudo iniciar sesión',
    espera,
  );
}
