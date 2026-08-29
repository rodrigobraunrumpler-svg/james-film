import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_API_BASE = '/api';
process.env.NEXT_PUBLIC_API_TIMEOUT_MS = '15000';

const { api } = await import('./http');
const { ApiError, NetworkError, TimeoutError } = await import('./errors');

/** `fetch` tipado: sin esto `mock.calls[n]` sale como tupla vacía. */
type FetchMock = (url: URL | string, init?: RequestInit) => Promise<Response>;
const mockFetch = (impl: FetchMock) => vi.fn<FetchMock>(impl);

const envuelto = (data: unknown, meta?: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, meta, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const fallo = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  vi.unstubAllGlobals();
  // buildUrl usa window.location.origin: en el proyecto `nodo` no hay window.
  vi.stubGlobal('window', { location: { origin: 'http://localhost:3001' } });
});

describe('cliente HTTP', () => {
  it('desenvuelve el sobre y devuelve data y meta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(envuelto([{ id: 'a' }], { totalCount: 1 }))),
    );

    const r = await api.get<{ id: string }[]>('/admin/galleries');

    expect(r.data).toEqual([{ id: 'a' }]);
    expect(r.meta).toEqual({ totalCount: 1 });
  });

  it('un error trae code y details tipados, no una cadena que parsear', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          fallo(422, {
            success: false,
            statusCode: 422,
            code: 'VALIDATION_FAILED',
            message: 'Revisa los campos marcados',
            details: [{ field: 'items.0.text', code: 'isNotEmpty', message: 'Vacío' }],
            timestamp: 'x',
          }),
        ),
      ),
    );

    const e = await api.post('/admin/galleries', {}).catch((x: unknown) => x);

    expect(e).toBeInstanceOf(ApiError);
    const err = e as InstanceType<typeof ApiError>;
    expect(err.code).toBe('VALIDATION_FAILED');
    // Es lo que permite setError(field) sin parsear inglés.
    expect(err.details?.[0]?.field).toBe('items.0.text');
    expect(err.isValidation).toBe(true);
  });

  it('esSesionMuerta distingue lo que manda al login de lo que no', async () => {
    const construir = (code: string, status: number) =>
      new ApiError(status, {
        success: false,
        statusCode: status,
        code,
        message: '',
        timestamp: '',
      } as never);

    expect(construir('SESSION_EXPIRED', 401).esSesionMuerta).toBe(true);
    expect(construir('SESSION_REVOKED', 401).esSesionMuerta).toBe(true);
    // Un 409 de slug duplicado NO debe cerrar la sesión.
    expect(construir('SLUG_TAKEN', 409).esSesionMuerta).toBe(false);
  });

  it('la query omite los undefined: nada de ?categoryId=undefined', async () => {
    const f = mockFetch(() => Promise.resolve(envuelto([])));
    vi.stubGlobal('fetch', f);

    await api.get('/admin/galleries', { query: { page: 2, categoryId: undefined, q: null } });

    expect(String(f.mock.calls[0]![0])).toBe('http://localhost:3001/api/admin/galleries?page=2');
  });

  it('un 204 no intenta parsear JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
    await expect(api.delete('/admin/media/x')).resolves.toEqual({
      data: undefined,
      meta: undefined,
    });
  });

  it('Content-Type solo cuando hay cuerpo', async () => {
    const f = mockFetch(() => Promise.resolve(envuelto({})));
    vi.stubGlobal('fetch', f);

    await api.get('/admin/galleries');
    expect((f.mock.calls[0]![1]!.headers as Headers).get('content-type')).toBeNull();

    await api.post('/admin/galleries', { title: 'x' });
    expect((f.mock.calls[1]![1]!.headers as Headers).get('content-type')).toBe('application/json');
  });

  it('una cancelación del llamante se relanza SIN envolver', async () => {
    // Si se envolviera, TanStack Query la trataría como error y sacaría un toast
    // al navegar, que es justo lo que no debe pasar.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('abortado', 'AbortError'))),
    );

    const ctrl = new AbortController();
    ctrl.abort();
    const e = await api.get('/x', { signal: ctrl.signal }).catch((x: unknown) => x);

    expect(e).toBeInstanceOf(DOMException);
    expect(e).not.toBeInstanceOf(ApiError);
  });

  it('el timeout da TimeoutError, distinguible de "no hay conexión"', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        (_u, init) =>
          new Promise<Response>((_ok, rej) => {
            init?.signal?.addEventListener('abort', () =>
              rej(new DOMException('timeout', 'TimeoutError')),
            );
          }),
      ),
    );

    const e = await api.get('/x', { timeoutMs: 20 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(TimeoutError);
    // La UI dice "el servidor tarda", no "algo falló".
    expect((e as InstanceType<typeof TimeoutError>).message).toContain('tardó');
  });

  it('una caída de red da NetworkError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    const e = await api.get('/x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(NetworkError);
    expect((e as InstanceType<typeof NetworkError>).isRetryable).toBe(true);
  });
});
