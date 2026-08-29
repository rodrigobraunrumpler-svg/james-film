import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { EditorGaleria } from './editor-galeria';

const CATEGORIAS = [{ id: 'c1', slug: 'bodas', name: 'Bodas' }];

const medio = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'REEL',
  orientation: 'VERTICAL',
  url: `https://cdn.test/${id}.mp4`,
  posterUrl: `https://cdn.test/${id}.jpg`,
  width: 1080,
  height: 1920,
  durationSec: 30,
  alt: id,
  caption: null,
  order: 0,
  isFeatured: false,
  status: 'READY',
  error: null,
  ...over,
});

const galeria = (media: unknown[]) => ({
  id: 'g1',
  slug: 'xv-de-camila',
  title: 'XV de Camila',
  description: null,
  eventDate: null,
  location: null,
  coverUrl: null,
  isFeatured: false,
  category: CATEGORIAS[0],
  media,
});

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function servidor(opciones: { media?: unknown[]; reorder?: () => Response } = {}) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  let media = opciones.media ?? [medio('m1'), medio('m2'), medio('m3')];

  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
      const metodo = init?.method ?? 'GET';
      const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      llamadas.push({ metodo, ruta: url.pathname, cuerpo });

      if (url.pathname === '/api/admin/categories') return Promise.resolve(ok(CATEGORIAS));
      if (url.pathname.endsWith('/media/reorder')) {
        if (opciones.reorder) return Promise.resolve(opciones.reorder());
        const ids = (cuerpo as { ids: string[] }).ids;
        media = ids.map((id) => media.find((m) => (m as { id: string }).id === id)).filter(Boolean);
        return Promise.resolve(ok(galeria(media)));
      }
      if (url.pathname.endsWith('/cover')) {
        const mediaId = url.pathname.split('/').at(-2);
        media = media.map((m) => ({ ...(m as object), isFeatured: (m as { id: string }).id === mediaId }));
        return Promise.resolve(ok(galeria(media)));
      }
      return Promise.resolve(ok(galeria(media)));
    }),
  );

  return {
    llamadas,
    de: (metodo: string, fragmento: string) =>
      llamadas.filter((l) => l.metodo === metodo && l.ruta.includes(fragmento)),
  };
}

let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
);

const ESPERA = { timeout: 5000 } as const;

/** Los nombres visibles de las tarjetas, en el orden en que están pintadas. */
const ordenEnPantalla = (): string[] =>
  within(screen.getByRole('list')).getAllByRole('listitem').map((li) => {
    const nombre = li.querySelector('p');
    return nombre?.textContent ?? '';
  });

beforeEach(() => {
  cliente = crearQueryClient(() => {});
  vi.clearAllMocks();
});

describe('grilla de medios', () => {
  it('pinta un medio por fila del servidor, con su portada marcada', async () => {
    servidor({ media: [medio('m1'), medio('m2', { isFeatured: true })] });

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    await screen.findByLabelText('Título');
    expect(ordenEnPantalla()).toEqual(['m1', 'm2']);
    expect(screen.getByText('Portada')).toBeInTheDocument();
  });

  it('mover reordena en pantalla al instante, sin esperar a la red', async () => {
    // El PATCH va con 800 ms de debounce: esperar a la red en cada movimiento
    // sería inusable colocando ocho reels.
    const usuario = userEvent.setup();
    servidor();

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');

    await usuario.click(screen.getByRole('button', { name: 'Mover m3 antes' }));

    expect(ordenEnPantalla()).toEqual(['m1', 'm3', 'm2']);
  });

  it('manda TODOS los ids, y en el orden que hay al enviar', async () => {
    // ReorderService numera 0..n-1 solo los ids que recibe: uno que falte
    // conserva su `order` y queda descolocado, sin ningún error.
    const usuario = userEvent.setup();
    const api = servidor();

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');

    await usuario.click(screen.getByRole('button', { name: 'Mover m1 después' }));

    await waitFor(() => expect(api.de('PATCH', '/media/reorder')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/media/reorder')[0].cuerpo).toEqual({ ids: ['m2', 'm1', 'm3'] });
  });

  it('varios movimientos seguidos son UN solo PATCH', async () => {
    const usuario = userEvent.setup();
    const api = servidor();

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');

    await usuario.click(screen.getByRole('button', { name: 'Mover m1 después' }));
    await usuario.click(screen.getByRole('button', { name: 'Mover m1 después' }));

    await waitFor(() => expect(api.de('PATCH', '/media/reorder')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/media/reorder')[0].cuerpo).toEqual({ ids: ['m2', 'm3', 'm1'] });
  });

  it('si el PATCH falla, revierte al orden que había y lo dice', async () => {
    const usuario = userEvent.setup();
    servidor({
      reorder: () =>
        new Response(
          JSON.stringify({ success: false, statusCode: 500, code: 'INTERNAL', message: 'x', timestamp: 'x' }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        ),
    });

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');

    await usuario.click(screen.getByRole('button', { name: 'Mover m3 antes' }));
    expect(ordenEnPantalla()).toEqual(['m1', 'm3', 'm2']);

    // Volver al estado real es más importante que el mensaje: si no, James cree
    // que guardó un orden que el servidor no tiene.
    await waitFor(() => expect(ordenEnPantalla()).toEqual(['m1', 'm2', 'm3']), ESPERA);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el orden');
  });

  it('el primero no puede moverse antes, ni el último después', async () => {
    servidor();

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');

    expect(screen.getByRole('button', { name: 'Mover m1 antes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mover m3 después' })).toBeDisabled();
  });

  it('marcar portada es optimista y exclusiva: la anterior se desmarca sola', async () => {
    const usuario = userEvent.setup();
    servidor({ media: [medio('m1', { isFeatured: true }), medio('m2')] });

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');

    await usuario.click(screen.getByRole('button', { name: 'Hacer portada' }));

    // Una sola etiqueta: verse dos portadas hasta que responda el servidor
    // sería peor que no ser optimista.
    await waitFor(() => expect(screen.getAllByText('Portada')).toHaveLength(1));
  });

  it('un medio que no está READY no puede ser portada', async () => {
    // Marcaría como portada un objeto que todavía no existe en el bucket.
    servidor({ media: [medio('m1', { status: 'PENDING' })] });

    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');

    expect(screen.queryByRole('button', { name: 'Hacer portada' })).not.toBeInTheDocument();
  });
});
