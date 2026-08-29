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

/** Devuelve el par nuevo, o null si el refresh ya no vale (expirado o revocado). */
/**
 * Devuelve la sesión nueva o el MOTIVO por el que no la hay. Antes devolvía
 * `null` para todo, y con eso la pasarela no podía distinguir «tu sesión
 * caducó» de «la cerramos por seguridad» —que es el reuso del refresh token y
 * merece que James se entere—.
 */
export type ResultadoRefresh =
  { ok: true; sesion: Sesion } | { ok: false; code: 'SESSION_EXPIRED' | 'SESSION_REVOKED' };

export async function refrescar(refreshToken: string): Promise<ResultadoRefresh> {
  const res = await fetch(`${serverConfig.apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(serverConfig.timeoutMs),
    cache: 'no-store',
  });

  if (!res.ok) {
    const fallo = (await res.json().catch(() => undefined)) as { code?: string } | undefined;
    return {
      ok: false,
      code: fallo?.code === 'SESSION_REVOKED' ? 'SESSION_REVOKED' : 'SESSION_EXPIRED',
    };
  }

  // La API envuelve TODA respuesta: { success, code, data, timestamp }.
  const cuerpo = (await res.json()) as { data?: Sesion };
  return cuerpo.data ? { ok: true, sesion: cuerpo.data } : { ok: false, code: 'SESSION_EXPIRED' };
}
