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
    //
    // `Retry-After` se reenvía porque es el ÚNICO dato que convierte «espera un
    // minuto» en un reloj. Sin él James reintenta a los diez segundos, vuelve a
    // fallar y la ventana del throttler se le reinicia.
    const espera = res.headers.get('retry-after');
    return NextResponse.json(cuerpo ?? { code: 'INTERNAL' }, {
      status: res.status,
      headers: espera ? { 'retry-after': espera } : undefined,
    });
  }

  const tokens = (cuerpo as { data?: Sesion } | undefined)?.data;
  if (!tokens?.accessToken || !tokens.refreshToken) {
    return NextResponse.json(
      {
        success: false,
        statusCode: 502,
        code: 'INTERNAL',
        message: 'Respuesta inesperada al iniciar sesión',
      },
      { status: 502 },
    );
  }

  await guardarSesion(tokens);
  // Los tokens NO viajan al navegador: solo se confirma que hay sesión.
  return NextResponse.json({ success: true, code: 'OK', data: { ok: true } });
}
