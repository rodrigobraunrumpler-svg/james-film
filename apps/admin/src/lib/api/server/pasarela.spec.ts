import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `cookies()` de next/headers lanza fuera de un ámbito de petición, así que se
 * mockea el almacén entero. Es el motivo de que este fichero viva en el proyecto
 * `nodo` y no en `dom`.
 */
const almacen = new Map<string, string>();
const cookiesFalsas = {
  get: (n: string) => (almacen.has(n) ? { name: n, value: almacen.get(n)! } : undefined),
  set: vi.fn((n: string, v: string, o?: unknown) => {
    almacen.set(n, v);
    opcionesUltimaCookie = o;
  }),
  delete: vi.fn((n: string) => almacen.delete(n)),
};
let opcionesUltimaCookie: unknown;

vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(cookiesFalsas) }));

process.env.API_URL ??= 'http://api.test';
process.env.API_TIMEOUT_MS ??= '15000';

const { pasarela } = await import('./pasarela.js');
const { COOKIE, guardarSesion } = await import('./session.js');

const peticion = (url = 'http://localhost:3001/api/admin/galleries', init?: RequestInit) =>
  new NextRequest(new Request(url, init));
const ctx = (ruta: string[]) => ({ params: Promise.resolve({ ruta }) });

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

/** `fetch` tipado, para que `mock.calls[n]` no salga como tupla vacía. */
type FetchMock = (url: URL | string, init?: RequestInit) => Promise<Response>;
const mockFetch = (impl: FetchMock) => vi.fn<FetchMock>(impl);

/** La API envuelve TODA respuesta correcta: `refrescar` tiene que desenvolverla. */
const envuelta = (data: unknown, status = 200) =>
  respuesta({ success: true, code: 'OK', data, timestamp: '2026-08-28T00:00:00.000Z' }, status);

beforeEach(() => {
  almacen.clear();
  vi.clearAllMocks();
});

describe('pasarela', () => {
  it('adjunta el Bearer y NO reenvía la cookie de sesión a la API', async () => {
    await guardarSesion({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch(() => Promise.resolve(respuesta({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    await pasarela(
      peticion('http://localhost:3001/api/admin/galleries', {
        headers: { cookie: 'jf_sesion=secreto', 'x-custom': 'sí' },
      }),
      ctx(['admin', 'galleries']),
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://api.test/admin/galleries');
    const h = (init as RequestInit).headers as Headers;
    expect(h.get('authorization')).toBe('Bearer acc-1');
    // La cookie de sesión es del dominio del admin: reenviarla filtraría el
    // refresh a la API en cada petición, sin necesidad ninguna.
    expect(h.get('cookie')).toBeNull();
    expect(h.get('x-custom')).toBe('sí'); // el resto sí pasa
  });

  it('un 401 dispara UN refresh y reintenta UNA vez', async () => {
    await guardarSesion({ accessToken: 'viejo', refreshToken: 'ref-1' });
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValueOnce(respuesta({ message: 'no' }, 401))
      .mockResolvedValueOnce(envuelta({ accessToken: 'nuevo', refreshToken: 'ref-2' }))
      .mockResolvedValueOnce(respuesta({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]![0])).toContain('/auth/refresh');
    // El reintento lleva el token NUEVO, no el caducado.
    expect((fetchMock.mock.calls[2]![1]!.headers as Headers).get('authorization')).toBe(
      'Bearer nuevo',
    );
    expect(almacen.get(COOKIE)).toContain('ref-2');
  });

  it('si el refresh falla, borra la cookie y devuelve 401 sin reintentar', async () => {
    await guardarSesion({ accessToken: 'viejo', refreshToken: 'ref-1' });
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValueOnce(respuesta({}, 401))
      .mockResolvedValueOnce(respuesta({ code: 'SESSION_REVOKED' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no hay tercer intento
    expect(cookiesFalsas.delete).toHaveBeenCalled();
  });

  it('los códigos pasan sin aplanarse: un 409 llega como 409 con su cuerpo', async () => {
    await guardarSesion({ accessToken: 'acc', refreshToken: 'ref' });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(respuesta({ code: 'SLUG_TAKEN', message: 'ya existe' }, 409))),
    );

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    // Una pasarela que aplana los errores a 500 es inútil: el admin distingue
    // por `code` y necesita el status real.
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'SLUG_TAKEN' });
  });

  it('reenvía el cuerpo y la query string', async () => {
    await guardarSesion({ accessToken: 'acc', refreshToken: 'ref' });
    const fetchMock = mockFetch(() => Promise.resolve(respuesta({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    await pasarela(
      peticion('http://localhost:3001/api/admin/galleries?page=2&pageSize=20', {
        method: 'POST',
        body: JSON.stringify({ title: 'XV de Camila' }),
        headers: { 'content-type': 'application/json' },
      }),
      ctx(['admin', 'galleries']),
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://api.test/admin/galleries?page=2&pageSize=20');
    expect(init!.body).toBe('{"title":"XV de Camila"}');
  });

  it('sin sesión no manda Authorization, pero deja pasar la petición', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(respuesta({}, 401)));
    vi.stubGlobal('fetch', fetchMock);

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    expect((fetchMock.mock.calls[0]![1]!.headers as Headers).get('authorization')).toBeNull();
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1); // sin refreshToken no hay refresh
  });
});

describe('un fallo de red NO cierra la sesión', () => {
  /** Primero un 401 (el access caducó), luego lo que le pase al refresh. */
  const accessCaducadoYLuego = (alRefrescar: () => Promise<Response>) =>
    mockFetch((url) =>
      String(url).includes('/auth/refresh')
        ? alRefrescar()
        : Promise.resolve(respuesta({ code: 'UNAUTHORIZED' }, 401)),
    );

  it('con la API caída al refrescar, la cookie SIGUE ahí', async () => {
    await guardarSesion({ accessToken: 'viejo', refreshToken: 'ref-bueno' });
    vi.stubGlobal(
      'fetch',
      accessCaducadoYLuego(() => Promise.reject(new TypeError('fetch failed'))),
    );

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    // No pudimos ni preguntar: el refresh sigue siendo válido 30 días. Borrarla
    // obligaba a James a reescribir la contraseña por una caída del servidor.
    expect(almacen.get(COOKIE)).toBeDefined();
    expect(res.status).toBe(502);
    expect(((await res.json()) as { code: string }).code).toBe('INTERNAL');
  });

  it('si la API devuelve 500 al refrescar, tampoco se borra', async () => {
    await guardarSesion({ accessToken: 'viejo', refreshToken: 'ref-bueno' });
    vi.stubGlobal(
      'fetch',
      accessCaducadoYLuego(() => Promise.resolve(respuesta({ code: 'INTERNAL' }, 500))),
    );

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    // Un 5xx es un problema de la API, no un veredicto sobre el refresh.
    expect(almacen.get(COOKIE)).toBeDefined();
    expect(res.status).toBe(502);
  });

  it('pero si la API DICE que el refresh no vale, sí se borra', async () => {
    await guardarSesion({ accessToken: 'viejo', refreshToken: 'ref-muerto' });
    vi.stubGlobal(
      'fetch',
      accessCaducadoYLuego(() =>
        Promise.resolve(respuesta({ code: 'SESSION_EXPIRED' }, 401)),
      ),
    );

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    expect(almacen.get(COOKIE)).toBeUndefined();
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe('SESSION_EXPIRED');
  });

  it('y el reuso del refresh se distingue: se cerró por seguridad', async () => {
    await guardarSesion({ accessToken: 'viejo', refreshToken: 'ref-reusado' });
    vi.stubGlobal(
      'fetch',
      accessCaducadoYLuego(() =>
        Promise.resolve(respuesta({ code: 'SESSION_REVOKED' }, 401)),
      ),
    );

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    expect(almacen.get(COOKIE)).toBeUndefined();
    expect(((await res.json()) as { code: string }).code).toBe('SESSION_REVOKED');
  });
});

describe('cuando la API no contesta', () => {
  it('con la API caída devuelve 502 y el SOBRE, no un 500 mudo', async () => {
    // Sin capturar el fallo del `fetch`, Next devolvía un 500 con el cuerpo
    // vacío: el cliente del admin espera el sobre y solo podía decir
    // «respuesta no válida del servidor», que no explica nada.
    vi.stubGlobal(
      'fetch',
      mockFetch(() => Promise.reject(new TypeError('fetch failed'))),
    );

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    expect(res.status).toBe(502);
    const cuerpo = (await res.json()) as { success: boolean; code: string; message: string };
    expect(cuerpo.success).toBe(false);
    expect(cuerpo.code).toBe('INTERNAL');
    // El mensaje dice QUÉ hacer, no «error interno».
    expect(cuerpo.message).toMatch(/reiniciándose|vuelve a intentarlo/i);
  });

  it('si vence el tiempo devuelve 504, que es lo que de verdad pasó', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(() => Promise.reject(new DOMException('The operation timed out', 'TimeoutError'))),
    );

    const res = await pasarela(peticion(), ctx(['admin', 'galleries']));

    expect(res.status).toBe(504);
    expect(((await res.json()) as { message: string }).message).toMatch(/tardó demasiado/i);
  });

  it('ambos son ≥500, así que TanStack Query los reintenta solo', async () => {
    // `isRetryable` en `lib/api/errors` es `status >= 500`: si la API estaba
    // arrancando, la pantalla se arregla sin que James toque nada.
    for (const [error, esperado] of [
      [new TypeError('fetch failed'), 502],
      [new DOMException('t', 'TimeoutError'), 504],
    ] as const) {
      vi.stubGlobal(
        'fetch',
        mockFetch(() => Promise.reject(error)),
      );
      const res = await pasarela(peticion(), ctx(['admin', 'galleries']));
      expect(res.status).toBe(esperado);
      expect(res.status).toBeGreaterThanOrEqual(500);
    }
  });
});

describe('cookie de sesión', () => {
  it('es httpOnly, sameSite lax, path / y con maxAge', async () => {
    await guardarSesion({ accessToken: 'a', refreshToken: 'b' });
    expect(opcionesUltimaCookie).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    expect((opcionesUltimaCookie as { maxAge: number }).maxAge).toBeGreaterThan(0);
  });
});
