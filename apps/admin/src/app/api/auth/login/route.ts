import { NextResponse, type NextRequest } from 'next/server';
import { serverConfig } from '@/lib/api/server/config';
import { guardarSesion, type Sesion } from '@/lib/api/server/session';

export const dynamic = 'force-dynamic';

/**
 * El login NO pasa por la pasarela genérica: su respuesta lleva los tokens, y
 * tienen que quedarse aquí. Si salieran al navegador, todo el diseño —el token
 * nunca llega al JS— se cae.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const res = await fetch(`${serverConfig.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await req.text(),
    signal: AbortSignal.timeout(serverConfig.timeoutMs),
    cache: 'no-store',
  });

  const cuerpo: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    // El error se devuelve tal cual: el formulario distingue por `code`
    // (INVALID_CREDENTIALS vs RATE_LIMITED) para elegir el mensaje.
    return NextResponse.json(cuerpo ?? { code: 'INTERNAL' }, { status: res.status });
  }

  const tokens = (cuerpo as { data?: Sesion } | undefined)?.data;
  if (!tokens?.accessToken || !tokens.refreshToken) {
    return NextResponse.json(
      { success: false, statusCode: 502, code: 'INTERNAL', message: 'Respuesta inesperada al iniciar sesión' },
      { status: 502 },
    );
  }

  await guardarSesion(tokens);
  // Los tokens NO viajan al navegador: solo se confirma que hay sesión.
  return NextResponse.json({ success: true, code: 'OK', data: { ok: true } });
}
