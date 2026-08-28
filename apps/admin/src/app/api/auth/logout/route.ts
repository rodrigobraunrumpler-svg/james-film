import { NextResponse } from 'next/server';
import { serverConfig } from '@/lib/api/server/config';
import { borrarSesion, leerSesion } from '@/lib/api/server/session';

export const dynamic = 'force-dynamic';

/**
 * `POST /auth/logout` de la API es el ÚNICO sitio donde se revoca la sesión.
 * Si aquí solo se borrara la cookie, el refresh seguiría vivo 30 días y el botón
 * no haría lo que dice.
 */
export async function POST(): Promise<NextResponse> {
  const sesion = await leerSesion();

  if (sesion?.refreshToken) {
    await fetch(`${serverConfig.apiUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: sesion.refreshToken }),
      signal: AbortSignal.timeout(serverConfig.timeoutMs),
      cache: 'no-store',
    }).catch(() => {
      // Si la API no responde, la cookie se borra igual: dejar al usuario dentro
      // porque el servidor está caído sería peor.
    });
  }

  await borrarSesion();
  return new NextResponse(null, { status: 204 });
}
