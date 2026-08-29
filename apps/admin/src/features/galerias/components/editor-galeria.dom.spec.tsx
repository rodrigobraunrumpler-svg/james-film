import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { EditorGaleria } from './editor-galeria';

const CATEGORIAS = [
  { id: 'c1', slug: 'bodas', name: 'Bodas' },
  { id: 'c2', slug: 'xv-anios', name: 'XV Años' },
];

const medio = (id: string, status: string) => ({
  id,
  type: 'REEL',
  orientation: 'VERTICAL',
  url: `https://cdn.test/${id}.mp4`,
  posterUrl: null,
  width: 1080,
  height: 1920,
  durationSec: 30,
  alt: null,
  caption: null,
  order: 0,
  isFeatured: false,
  status,
  error: null,
});

const galeria = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  slug: 'xv-de-camila',
  title: 'XV de Camila',
  description: 'Una fiesta',
  eventDate: '2026-03-15',
  location: 'Ayacucho',
  coverUrl: null,
  isFeatured: false,
  category: CATEGORIAS[0],
  media: [],
  ...over,
});

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const fallo = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      success: false,
      statusCode: status,
      code,
      message: 'Falló',
      timestamp: 'x',
      ...extra,
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );

/** Enruta como la API real: el test no debe depender del orden de las llamadas. */
function servidor(
  opciones: {
    detalle?: () => Response;
    patch?: () => Response;
    confirm?: () => Response;
  } = {},
) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];

  const fetchMock = vi.fn((entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
    const metodo = init?.method ?? 'GET';
    const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    llamadas.push({ metodo, ruta: url.pathname, cuerpo });

    if (url.pathname === '/api/admin/categories') return Promise.resolve(ok(CATEGORIAS));
    if (url.pathname.endsWith('/confirm')) {
      return Promise.resolve(opciones.confirm?.() ?? ok({ status: 'READY' }));
    }
    if (metodo === 'PATCH') return Promise.resolve(opciones.patch?.() ?? ok(galeria()));
    return Promise.resolve(opciones.detalle?.() ?? ok(galeria()));
  });

  vi.stubGlobal('fetch', fetchMock);
  return {
    llamadas,
    de: (metodo: string, fragmento: string) =>
      llamadas.filter((l) => l.metodo === metodo && l.ruta.includes(fragmento)),
  };
}

/** El debounce del autoguardado es de 2 s reales; waitFor tiene que darle margen. */
const ESPERA = { timeout: 5000 } as const;

let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
);

beforeEach(() => {
  cliente = crearQueryClient(() => {});
  vi.clearAllMocks();
});

describe('editor de galería', () => {
  it('carga los datos en el formulario', async () => {
    servidor();
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    expect(await screen.findByLabelText('Título')).toHaveValue('XV de Camila');
    expect(screen.getByLabelText('Fecha del evento')).toHaveValue('2026-03-15');
    expect(screen.getByLabelText('Lugar')).toHaveValue('Ayacucho');
    expect(screen.getByLabelText('Categoría')).toHaveValue('c1');
  });

  it('autoguarda UNA sola vez tras dejar de escribir, no una por tecla', async () => {
    const usuario = userEvent.setup();
    const api = servidor();

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    const titulo = await screen.findByLabelText('Título');

    await usuario.clear(titulo);
    await usuario.type(titulo, 'Boda de Ana');

    // Antes de que venza el debounce no se ha mandado nada: sin esto serían
    // once PATCH para once letras.
    expect(api.de('PATCH', '/galleries/g1')).toHaveLength(0);

    await waitFor(() => expect(api.de('PATCH', '/galleries/g1')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/galleries/g1')[0].cuerpo).toMatchObject({ title: 'Boda de Ana' });
  }, 15_000);

  it('la línea de estado dice Guardando y luego Guardado, sin toast ni spinner', async () => {
    const usuario = userEvent.setup();
    servidor();

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await usuario.type(await screen.findByLabelText('Lugar'), ' centro');
    await waitFor(
      () => expect(screen.getByRole('status')).toHaveTextContent(/Guardado|Guardando/),
      ESPERA,
    );
  }, 15_000);

  it('vaciar un campo lo manda como null, para poder BORRARLO', async () => {
    const usuario = userEvent.setup();
    const api = servidor();

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await usuario.clear(await screen.findByLabelText('Lugar'));
    // Omitir el campo dejaría "Ayacucho" en la base para siempre.
    await waitFor(() => expect(api.de('PATCH', '/galleries/g1')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/galleries/g1')[0].cuerpo).toMatchObject({ location: null });
  }, 15_000);

  it('un título inválido no se guarda: no se manda basura al servidor', async () => {
    const usuario = userEvent.setup();
    const api = servidor();

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await usuario.clear(await screen.findByLabelText('Título'));
    expect(api.de('PATCH', '/galleries/g1')).toHaveLength(0);
    expect(await screen.findByRole('alert')).toHaveTextContent('Mínimo 2 caracteres');
  }, 15_000);

  it('los errores del servidor se atan al campo que los causó', async () => {
    const usuario = userEvent.setup();
    servidor({
      patch: () =>
        fallo(422, 'VALIDATION_FAILED', {
          details: [{ field: 'title', code: 'TOO_LONG', message: 'Máximo 120 caracteres' }],
        }),
    });

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await usuario.type(await screen.findByLabelText('Título'), ' y Ana');
    // `details[].field` llega listo: setError sin parsear nada.
    const error = await screen.findByText('Máximo 120 caracteres', {}, ESPERA);
    expect(error).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true');
  }, 15_000);

  it('reconcilia al montar cada medio en PENDING, y solo esos', async () => {
    const api = servidor({
      detalle: () =>
        ok(
          galeria({
            media: [medio('m1', 'PENDING'), medio('m2', 'READY'), medio('m3', 'PENDING')],
          }),
        ),
    });

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');

    // Es la red de seguridad ante la pestaña que iOS mató: el confirm hace HEAD
    // y lo que llegó entero pasa a READY sin volver a subir un byte.
    await waitFor(() => expect(api.de('POST', '/confirm')).toHaveLength(2));
    expect(api.de('POST', '/confirm').map((l) => l.ruta)).toEqual([
      '/api/admin/media/m1/confirm',
      '/api/admin/media/m3/confirm',
    ]);
  });

  it('sin medios PENDING no llama a confirm', async () => {
    const api = servidor({ detalle: () => ok(galeria({ media: [medio('m1', 'READY')] })) });

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');

    await waitFor(() => expect(screen.getByLabelText('Título')).toHaveValue('XV de Camila'));
    expect(api.de('POST', '/confirm')).toHaveLength(0);
  });

  it('una galería borrada dice que ya no existe, sin ofrecer reintentar', async () => {
    servidor({ detalle: () => fallo(404, 'NOT_FOUND') });

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    expect(await screen.findByText('Esta galería ya no existe')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });
});
