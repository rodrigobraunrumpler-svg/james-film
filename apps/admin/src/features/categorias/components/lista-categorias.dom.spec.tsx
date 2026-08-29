import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from 'sonner';
import { crearQueryClient } from '@/lib/query/cliente';
import { ListaCategorias } from './lista-categorias';

const categoria = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  slug: name.toLowerCase(),
  name,
  tagline: null,
  description: null,
  coverUrl: null,
  isActive: true,
  order: 0,
  metaTitle: null,
  metaDescription: null,
  galleryCount: 0,
  packageCount: 0,
  ...over,
});

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const fallo = (status: number, code: string, message: string) =>
  new Response(
    JSON.stringify({ success: false, statusCode: status, code, message, timestamp: 'x' }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  );

function servidor(opciones: { lista?: unknown[]; reorder?: () => Response } = {}) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  let lista = opciones.lista ?? [
    categoria('c1', 'Bodas'),
    categoria('c2', 'XV'),
    categoria('c3', 'Eventos'),
  ];

  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
      const metodo = init?.method ?? 'GET';
      const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      llamadas.push({ metodo, ruta: url.pathname, cuerpo });

      if (url.pathname.endsWith('/reorder')) {
        if (opciones.reorder) return Promise.resolve(opciones.reorder());
        const ids = (cuerpo as { ids: string[] }).ids;
        lista = ids.map((id) => lista.find((c) => (c as { id: string }).id === id)!);
        return Promise.resolve(ok(lista));
      }
      return Promise.resolve(ok(lista));
    }),
  );

  return {
    de: (metodo: string, fragmento: string) =>
      llamadas.filter((l) => l.metodo === metodo && l.ruta.includes(fragmento)),
  };
}

let cliente = crearQueryClient(() => {});
// El `<Toaster />` va en el layout raíz, así que sin montarlo aquí los avisos
// no llegan al DOM y el test no vería el motivo que se le da a James.
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>
    {children}
    <Toaster />
  </QueryClientProvider>
);

const ESPERA = { timeout: 5000 } as const;

const ordenEnPantalla = (): string[] =>
  within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('span span')?.textContent ?? '');

beforeEach(() => {
  cliente = crearQueryClient(() => {});
  vi.clearAllMocks();
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

describe('lista de categorías', () => {
  it('pinta las categorías con su enlace y su recuento', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    expect(await screen.findByText('Bodas')).toBeInTheDocument();
    expect(screen.getByText(/\/bodas · 0 galerías/)).toBeInTheDocument();
  });

  it('marca las ocultas: una inactiva no se lee igual que una en vivo', async () => {
    servidor({ lista: [categoria('c1', 'Bodas', { isActive: false })] });
    render(<ListaCategorias />, { wrapper: Envoltorio });

    expect(await screen.findByText('Oculta')).toBeInTheDocument();
  });

  it('mover reordena en pantalla al instante, sin esperar a la red', async () => {
    const usuario = userEvent.setup();
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByText('Bodas');

    await usuario.click(screen.getByRole('button', { name: 'Mover Eventos antes' }));

    expect(ordenEnPantalla()).toEqual(['Bodas', 'Eventos', 'XV']);
  });

  it('manda TODOS los ids en el orden que hay al enviar', async () => {
    const usuario = userEvent.setup();
    const api = servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByText('Bodas');

    await usuario.click(screen.getByRole('button', { name: 'Mover Bodas después' }));

    await waitFor(() => expect(api.de('PATCH', '/reorder')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/reorder')[0].cuerpo).toEqual({ ids: ['c2', 'c1', 'c3'] });
  });

  it('varios movimientos seguidos son UN solo PATCH', async () => {
    const usuario = userEvent.setup();
    const api = servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByText('Bodas');

    await usuario.click(screen.getByRole('button', { name: 'Mover Bodas después' }));
    await usuario.click(screen.getByRole('button', { name: 'Mover Bodas después' }));

    await waitFor(() => expect(api.de('PATCH', '/reorder')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/reorder')[0].cuerpo).toEqual({ ids: ['c2', 'c3', 'c1'] });
  });

  it('si el reorden falla, revierte al orden que había y lo dice', async () => {
    const usuario = userEvent.setup();
    servidor({ reorder: () => fallo(500, 'INTERNAL', 'x') });
    render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByText('Bodas');

    await usuario.click(screen.getByRole('button', { name: 'Mover Eventos antes' }));
    expect(ordenEnPantalla()).toEqual(['Bodas', 'Eventos', 'XV']);

    // Volver al estado real importa más que el mensaje: si no, James cree que
    // guardó un orden que el servidor no tiene.
    await waitFor(() => expect(ordenEnPantalla()).toEqual(['Bodas', 'XV', 'Eventos']), ESPERA);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el orden');
  });

  it('el primero no puede subir, ni el último bajar', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByText('Bodas');

    expect(screen.getByRole('button', { name: 'Mover Bodas antes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mover Eventos después' })).toBeDisabled();
  });

  it('una categoría en uso NO se intenta borrar: se avisa con el número', async () => {
    // Los recuentos viajan con la fila justo para poder decirlo antes de
    // pulsar, en vez de dejar que el servidor lo rechace después.
    const usuario = userEvent.setup();
    const api = servidor({
      lista: [categoria('c1', 'Bodas', { galleryCount: 4, packageCount: 2 })],
    });
    render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByText('Bodas');

    await usuario.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(api.de('DELETE', '/admin/categories')).toHaveLength(0);
    expect(await screen.findByText(/4 galerías y 2 paquetes/)).toBeInTheDocument();
  });

  it('una categoría vacía sí se borra, tras confirmar', async () => {
    const usuario = userEvent.setup();
    const api = servidor({ lista: [categoria('c1', 'Vacía')] });
    render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByText('Vacía');

    await usuario.click(screen.getByRole('button', { name: 'Borrar' }));

    await waitFor(() => expect(api.de('DELETE', '/admin/categories/c1')).toHaveLength(1), ESPERA);
  });
});
