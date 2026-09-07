import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { serverConfig } from './config';
import { borrarSesion, guardarSesion, leerSesion, refrescar } from './session';

/**
 * Cabeceras que no se reenvían.
 * - Las de salto (`connection`, `keep-alive`…) las gestiona cada conexión.
 * - `cookie` porque la sesión es del dominio del ADMIN: mandarla a la API filtraría
 *   el refresh en cada petición sin ninguna necesidad.
 * - `content-length` porque el cuerpo se re-serializa y podría no cuadrar.
 */
const NO_REENVIAR = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
  'cookie',
  'content-length',
]);

function cabeceras(origen: Headers, token?: string): Headers {
  const h = new Headers();
  origen.forEach((v, k) => {
    if (!NO_REENVIAR.has(k.toLowerCase())) h.set(k, v);
  });
  if (token) h.set('authorization', `Bearer ${token}`);
  return h;
}

export async function pasarela(
  req: NextRequest,
  ctx: { params: Promise<{ ruta: string[] }> },
): Promise<NextResponse> {
  const { ruta } = await ctx.params;
  const destino = new URL(`${serverConfig.apiUrl}/${ruta.join('/')}`);
  destino.search = req.nextUrl.search;

  // Se lee a texto, no se reenvía el stream: el reintento tras el 401 necesita
  // poder releerlo, y un ReadableStream se consume una sola vez.
  const cuerpo = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  const sesion = await leerSesion();

  const enviar = (token?: string): Promise<Response> =>
    fetch(destino, {
      method: req.method,
      headers: cabeceras(req.headers, token),
      body: cuerpo,
      signal: AbortSignal.timeout(serverConfig.timeoutMs),
      cache: 'no-store',
    });

  let res: Response;
  try {
    res = await enviar(sesion?.accessToken);
  } catch (e) {
    return sinRespuesta(e);
  }

  // Un solo reintento, y solo si hay refresh que usar.
  if (res.status === 401 && sesion?.refreshToken) {
    const nueva = await refrescar(sesion.refreshToken);

    // No pudimos ni preguntar: la sesión NO se toca. Borrarla aquí convertía
    // una caída de la API en «Tu sesión caducó» con un refresh token bueno de
    // 30 días, y obligaba a James a volver a escribir la contraseña por un
    // problema que no era suyo.
    if (!nueva.ok && nueva.code === 'SIN_RESPUESTA') {
      return sinRespuesta(new Error('la API no respondió al refrescar'));
    }

    if (!nueva.ok) {
      await borrarSesion();
      // El `code` viaja tal cual: `SESSION_REVOKED` es el reuso del refresh y
      // el login lo cuenta distinto que una caducidad normal.
      return NextResponse.json(
        {
          success: false,
          statusCode: 401,
          code: nueva.code,
          message:
            nueva.code === 'SESSION_REVOKED'
              ? 'Tu sesión se cerró por seguridad'
              : 'Tu sesión ha expirado',
          timestamp: new Date().toISOString(),
        },
        { status: 401 },
      );
    }
    await guardarSesion(nueva.sesion);
    try {
      res = await enviar(nueva.sesion.accessToken);
    } catch (e) {
      return sinRespuesta(e);
    }
  }

  // El estado se devuelve TAL CUAL: el admin distingue por `code` y necesita el
  // status real. Una pasarela que aplana los errores a 500 es inútil.
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

/**
 * Cuando la API no contesta —no está levantada, se está reiniciando, o tarda
 * más que el timeout— el `fetch` LANZA. Sin capturarlo, Next devuelve un **500
 * con el cuerpo vacío**, y el cliente del admin, que espera el sobre, solo
 * puede decir «respuesta no válida del servidor»: ni el error dice qué pasa ni
 * hay forma de saber si es culpa del dato que mandaste.
 *
 * Se devuelve el sobre de siempre, con el estado que corresponde —504 si venció
 * el tiempo, 502 si no hubo nadie al otro lado— y un mensaje que dice qué
 * hacer. Ambos son ≥500, así que `isRetryable` deja que TanStack Query lo
 * reintente solo: si la API estaba arrancando, se arregla sin tocar nada.
 */
function sinRespuesta(e: unknown): NextResponse {
  const expiró = e instanceof DOMException && e.name === 'TimeoutError';
  const statusCode = expiró ? 504 : 502;

  console.error('[pasarela] la API no respondió:', e);

  return NextResponse.json(
    {
      success: false,
      statusCode,
      code: 'INTERNAL',
      message: expiró
        ? 'El servidor tardó demasiado en responder. Vuelve a intentarlo.'
        : 'No se pudo conectar con el servidor. Puede que esté reiniciándose: espera un momento y vuelve a intentarlo.',
      timestamp: new Date().toISOString(),
    },
    { status: statusCode },
  );
}
