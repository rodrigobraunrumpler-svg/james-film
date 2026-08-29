import type { ApiFailure, ApiSuccess, PaginationMeta } from '@james-film/contracts';
import { config } from './config';
import { ApiError, NetworkError, TimeoutError } from './errors';

export interface RequestOptions {
  /** El signal que TanStack Query pasa a queryFn. Se combina con el timeout. */
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
}

/** Lo que devuelve el cliente: el sobre ya desenvuelto. */
export interface Respuesta<T> {
  data: T;
  meta?: PaginationMeta;
}

/**
 * La pasarela ya intentó refrescar: si llega un 401, la sesión murió y no hay
 * nada que reintentar. Se va al login con el MOTIVO, porque «tu sesión caducó»
 * y «la cerramos por seguridad» piden reacciones distintas.
 *
 * `location.replace` y no el router de Next: hay que tirar TODO el estado del
 * cliente —la caché de TanStack Query incluida— y una navegación blanda lo
 * conservaría. Y sin entrada en el historial: el botón atrás desde el login no
 * puede devolver a una pantalla que ya no se puede cargar.
 */
function alLogin(code: string | undefined): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  const url = new URL('/login', window.location.origin);
  url.searchParams.set('motivo', code === 'SESSION_REVOKED' ? 'revocada' : 'caducada');
  url.searchParams.set('desde', window.location.pathname);
  window.location.replace(url.toString());
}

function construirUrl(ruta: string, query?: RequestOptions['query']): string {
  const url = new URL(`${config.base}${ruta}`, window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function leerJson(res: Response): Promise<unknown> {
  // 204 y 205 no traen cuerpo: pedir .json() lanza.
  if (res.status === 204 || res.status === 205) return undefined;
  const texto = await res.text();
  if (!texto) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    throw new ApiError(res.status, undefined, 'Respuesta no válida del servidor');
  }
}

async function peticion<T>(
  ruta: string,
  init: RequestInit = {},
  opts: RequestOptions = {},
): Promise<Respuesta<T>> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? config.timeoutMs);
  // AbortSignal.any es nativo: combina la cancelación de TanStack Query con el
  // timeout sin cablear listeners a mano.
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  const headers = new Headers(init.headers);
  // Content-Type SOLO si hay cuerpo: en un GET no aporta nada.
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(construirUrl(ruta, opts.query), { ...init, headers, signal });
  } catch (e) {
    // La cancelación del llamante se relanza TAL CUAL: envolverla haría que
    // TanStack Query la tratara como error y sacara un toast al navegar.
    if (opts.signal?.aborted) throw e;
    if (timeout.aborted) throw new TimeoutError();
    throw new NetworkError(e);
  }

  const cuerpo = await leerJson(res);

  if (!res.ok) {
    const error = new ApiError(res.status, cuerpo as ApiFailure | undefined);
    if (error.esSesionMuerta) alLogin(error.code);
    throw error;
  }

  const sobre = cuerpo as ApiSuccess<T> | undefined;
  return { data: sobre?.data as T, meta: sobre?.meta };
}

const conCuerpo = (body: unknown): RequestInit =>
  body === undefined ? {} : { body: JSON.stringify(body) };

export const api = {
  get: <T>(ruta: string, opts?: RequestOptions) => peticion<T>(ruta, { method: 'GET' }, opts),
  post: <T>(ruta: string, body?: unknown, opts?: RequestOptions) =>
    peticion<T>(ruta, { method: 'POST', ...conCuerpo(body) }, opts),
  patch: <T>(ruta: string, body?: unknown, opts?: RequestOptions) =>
    peticion<T>(ruta, { method: 'PATCH', ...conCuerpo(body) }, opts),
  put: <T>(ruta: string, body?: unknown, opts?: RequestOptions) =>
    peticion<T>(ruta, { method: 'PUT', ...conCuerpo(body) }, opts),
  delete: <T>(ruta: string, opts?: RequestOptions) => peticion<T>(ruta, { method: 'DELETE' }, opts),
};
