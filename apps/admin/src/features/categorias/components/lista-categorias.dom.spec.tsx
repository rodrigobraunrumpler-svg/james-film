import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from 'sonner';
import { crearQueryClient } from '@/lib/query/cliente';
import { ListaCategorias } from './lista-categorias';

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const categoria = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  slug: 'bodas',
  name: 'Bodas',
  tagline: null,
  description: null,
  coverUrl: null,
  isActive: true,
  order: 0,
  metaTitle: null,
  metaDescription: null,
  galleryCount: 6,
  packageCount: 2,
  recentCoverUrls: [],
  clickMix: [],
  clickTotal: 0,
  ...over,
});

const CUATRO = [
  categoria(),
  categoria({
    id: 'c2',
    slug: 'xv-anos',
    name: 'XV Años',
    galleryCount: 4,
    packageCount: 3,
    recentCoverUrls: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
    clickMix: [
      { packageId: 'p1', packageName: 'Pro', count: 24 },
      { packageId: 'p2', packageName: 'Básico', count: 10 },
    ],
    clickTotal: 34,
  }),
  categoria({ id: 'c3', slug: 'cumpleanos', name: 'Cumpleaños', galleryCount: 1, packageCount: 1 }),
  categoria({
    id: 'c4',
    slug: 'eventos',
    name: 'Eventos',
    isActive: false,
    galleryCount: 0,
    packageCount: 0,
  }),
];

function servidor(datos: unknown = CUATRO) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
      llamadas.push({
        metodo: init?.method ?? 'GET',
        ruta: url.pathname,
        cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      if (init?.method === 'PATCH') return Promise.resolve(ok(categoria()));
      return Promise.resolve(ok(datos));
    }),
  );
  return llamadas;
}

let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>
    {children}
    <Toaster />
  </QueryClientProvider>
);

beforeEach(() => {
  vi.restoreAllMocks();
  cliente = crearQueryClient(() => {});
});

describe('la lista de categorías', () => {
  it('cada tarjeta dice cuántas galerías y cuántos paquetes tiene', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    // El nombre sale DOS veces a propósito: en la tira del menú y en la tarjeta.
    // Se consulta por el `h3` de la tarjeta para no confundirlos.
    expect(await screen.findByRole('heading', { name: 'Bodas' })).toBeInTheDocument();
    expect(screen.getByText('6 galerías')).toBeInTheDocument();
    expect(screen.getByText('2 paqs.')).toBeInTheDocument();
    // Singular cuando toca: «1 galerías» se lee como un fallo.
    expect(screen.getByText('1 galería')).toBeInTheDocument();
    expect(screen.getByText('1 paq.')).toBeInTheDocument();
  });

  it('la tira del menú enseña el ORDEN con el que salen en la web', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'Bodas' });
    const tira = screen.getByRole('region', { name: 'Menú de la web' });
    const nombres = within(tira)
      .getAllByRole('listitem')
      .map((li) => li.textContent);

    expect(nombres).toEqual(['Bodas', 'XV Años', 'Cumpleaños', 'Eventos']);
  });

  it('una categoría oculta sale TACHADA en la tira, no desaparece de ella', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'Bodas' });
    const tira = screen.getByRole('region', { name: 'Menú de la web' });
    // Si desapareciera, ocultar una parecería haberla borrado.
    const eventos = within(tira).getByText('Eventos');
    expect(eventos.className).toContain('line-through');
  });

  it('dice a qué paquete van los clics de esa categoría', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'XV Años' });
    expect(screen.getByText('Sus clics van al')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('sin clics lo DICE, en vez de dejar el hueco y parecer que falta', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'Bodas' });
    expect(screen.getAllByText('Sin clics todavía').length).toBeGreaterThan(0);
  });

  it('enseña las portadas de sus galerías recientes cuando las hay', async () => {
    servidor();
    const { container } = render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'XV Años' });
    const miniaturas = container.querySelectorAll('img[src^="https://cdn.test/"]');
    expect(miniaturas).toHaveLength(2);
  });

  it('la primera no se puede subir y la última no se puede bajar', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'Bodas' });
    expect(screen.getByRole('button', { name: 'Mover Bodas antes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mover Eventos después' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mover Bodas después' })).toBeEnabled();
  });

  it('mover una categoría reordena la tira del menú al momento', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'Bodas' });
    await userEvent.click(screen.getByRole('button', { name: 'Mover Bodas después' }));

    const tira = screen.getByRole('region', { name: 'Menú de la web' });
    await waitFor(() => {
      const nombres = within(tira)
        .getAllByRole('listitem')
        .map((li) => li.textContent);
      expect(nombres).toEqual(['XV Años', 'Bodas', 'Cumpleaños', 'Eventos']);
    });
  });

  it('borrar una categoría en uso avisa ANTES, sin llegar al servidor', async () => {
    const llamadas = servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'Bodas' });
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones para Bodas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(await screen.findByText(/la usan 6 galerías y 2 paquetes/)).toBeInTheDocument();
    expect(llamadas.filter((l) => l.metodo === 'DELETE')).toHaveLength(0);
  });

  it('una categoría vacía sí llega a la confirmación', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'Eventos' });
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones para Eventos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(await screen.findByText(/Borrar «Eventos»/)).toBeInTheDocument();
  });

  it('ocultar y mostrar están en el menú, no como dos botones más en la fila', async () => {
    const llamadas = servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });

    await screen.findByRole('heading', { name: 'Bodas' });
    // Con cinco objetivos de 44px la fila no cabe en 320px.
    expect(screen.queryByRole('button', { name: 'Ocultar de la web' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Más acciones para Bodas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar de la web' }));

    await waitFor(() => {
      expect(llamadas.some((l) => l.metodo === 'PATCH' && l.cuerpo)).toBe(true);
    });
    expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ isActive: false });
  });

  it('el asa de arrastre ARRASTRA de verdad, no es solo un icono', async () => {
    servidor();
    const { container } = render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByRole('heading', { name: 'Bodas' });

    const tarjetas = container.querySelectorAll('article[draggable="true"]');
    expect(tarjetas).toHaveLength(4);

    // Soltar la primera sobre la segunda. `dataTransfer` a mano: happy-dom no
    // implementa el arrastre nativo, y sin él el evento llega sin datos.
    const datos = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => datos.set(k, v),
      getData: (k: string) => datos.get(k) ?? '',
    };
    fireEvent.dragStart(tarjetas[0]!, { dataTransfer });
    fireEvent.drop(tarjetas[1]!, { dataTransfer });

    const tira = screen.getByRole('region', { name: 'Menú de la web' });
    await waitFor(() => {
      const nombres = within(tira)
        .getAllByRole('listitem')
        .map((li) => li.textContent);
      expect(nombres).toEqual(['XV Años', 'Bodas', 'Cumpleaños', 'Eventos']);
    });
  });

  it('soltar una tarjeta sobre sí misma no reordena nada', async () => {
    servidor();
    const { container } = render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByRole('heading', { name: 'Bodas' });

    const tarjetas = container.querySelectorAll('article[draggable="true"]');
    const datos = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => datos.set(k, v),
      getData: (k: string) => datos.get(k) ?? '',
    };
    fireEvent.dragStart(tarjetas[0]!, { dataTransfer });
    fireEvent.drop(tarjetas[0]!, { dataTransfer });

    const tira = screen.getByRole('region', { name: 'Menú de la web' });
    expect(
      within(tira)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Bodas', 'XV Años', 'Cumpleaños', 'Eventos']);
  });

  it('una categoría visible ofrece verla en la web; una oculta no', async () => {
    servidor();
    render(<ListaCategorias />, { wrapper: Envoltorio });
    await screen.findByRole('heading', { name: 'Bodas' });

    expect(screen.getByRole('link', { name: 'Ver Bodas en la web' })).toBeInTheDocument();
    // Un enlace a una sección que la web no pinta lleva a un 404.
    expect(screen.queryByRole('link', { name: 'Ver Eventos en la web' })).not.toBeInTheDocument();
  });

  it('sin ninguna categoría, el estado vacío empuja a crear la primera', async () => {
    servidor([]);
    render(<ListaCategorias />, { wrapper: Envoltorio });

    expect(await screen.findByText('Aún no tienes categorías')).toBeInTheDocument();
    expect(screen.queryByText('Así sale el menú')).not.toBeInTheDocument();
  });
});
