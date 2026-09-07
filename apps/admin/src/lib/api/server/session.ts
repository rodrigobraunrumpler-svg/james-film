import 'server-only';
import { cookies } from 'next/headers';
import { serverConfig } from './config';

export const COOKIE = 'jf_sesion';

export interface Sesion {
  accessToken: string;
  refreshToken: string;
}

/**
 * La sesión vive en una cookie httpOnly del dominio del ADMIN, no de la API:
 * así el token nunca llega al JavaScript del navegador y `cookies()` y `proxy.ts`
 * funcionan. Enmienda a §16, ver CLAUDE.md.
 *
 * Sin cifrar a propósito: son credenciales opacas que la API valida por su cuenta,
 * el JS no puede leerlas, y manipularlas desde devtools solo rompe la sesión propia.
 */
export async function leerSesion(): Promise<Sesion | null> {
  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return null;
  try {
    const s: unknown = JSON.parse(bruto);
    return typeof s === 'object' && s !== null && 'accessToken' in s && 'refreshToken' in s
      ? (s as Sesion)
      : null;
  } catch {
    return null;
  }
}

export async function guardarSesion(s: Sesion): Promise<void> {
  (await cookies()).set(COOKIE, JSON.stringify(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // igual que el refresh de §16
  });
}

export async function borrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * Devuelve la sesión nueva o el MOTIVO por el que no la hay.
 *
 * Son TRES resultados, no dos, y la diferencia es la que decide si se borra la
 * cookie:
 *
 * - `SESSION_EXPIRED` / `SESSION_REVOKED` — **la API ha dicho que no**. El
 *   refresh ya no vale: hay que volver a entrar.
 * - `SIN_RESPUESTA` — **no hemos podido preguntárselo**: la API está caída, se
 *   está reiniciando o venció el tiempo. El refresh token **sigue siendo
 *   válido**, así que la sesión NO se toca.
 *
 * Sin esa tercera rama, cualquier corte de red cerraba la sesión de verdad
 * —borrando la cookie— y James veía «Tu sesión caducó» con un refresh token
 * perfectamente bueno de 30 días. Un fallo de infraestructura no puede
 * traducirse en «vuelve a escribir tu contraseña».
 */
export type ResultadoRefresh =
  | { ok: true; sesion: Sesion }
  | { ok: false; code: 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'SIN_RESPUESTA' };

export async function refrescar(refreshToken: string): Promise<ResultadoRefresh> {
  let res: Response;
  try {
    res = await fetch(`${serverConfig.apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(serverConfig.timeoutMs),
      cache: 'no-store',
    });
  } catch (e) {
    // Ni siquiera llegamos a preguntar: la sesión no tiene la culpa.
    console.error('[sesion] no se pudo contactar con la API para refrescar:', e);
    return { ok: false, code: 'SIN_RESPUESTA' };
  }

  if (!res.ok) {
    // Solo un 4xx es la API DICIENDO que el refresh no vale. Un 5xx es un
    // problema suyo, y cerrar la sesión por eso sería castigar a James por una
    // caída del servidor.
    if (res.status >= 500) return { ok: false, code: 'SIN_RESPUESTA' };

    const fallo = (await res.json().catch(() => undefined)) as { code?: string } | undefined;
    return {
      ok: false,
      code: fallo?.code === 'SESSION_REVOKED' ? 'SESSION_REVOKED' : 'SESSION_EXPIRED',
    };
  }

  // La API envuelve TODA respuesta: { success, code, data, timestamp }.
  const cuerpo = (await res.json().catch(() => undefined)) as { data?: Sesion } | undefined;
  return cuerpo?.data ? { ok: true, sesion: cuerpo.data } : { ok: false, code: 'SESSION_EXPIRED' };
}
