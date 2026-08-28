import type { ApiFailure } from '@james-film/contracts';
import type { DatosLogin } from '../schemas/login-schema';

export class ErrorLogin extends Error {
  constructor(readonly code: ApiFailure['code'], mensaje: string) {
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
  throw new ErrorLogin(cuerpo?.code ?? 'INTERNAL', cuerpo?.message ?? 'No se pudo iniciar sesión');
}
