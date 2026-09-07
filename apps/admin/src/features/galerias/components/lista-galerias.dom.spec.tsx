import { QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import type { FiltrosGalerias } from '../services/galerias';
import { ListaGalerias } from './lista-galerias';

// nuqs y next/navigation fuera de Next: se sustituye el estado de la URL por
// uno en memoria, que es lo que el componente realmente consume.
let filtrosActuales: FiltrosGalerias = { estado: 'todas', q: '', page: 1, pageSize: 20 };
const setFiltrosMock = vi.fn((p: Partial<typeof filtrosActuales>) => {
  filtrosActuales = { ...filtrosActuales, ...p };
});
vi.mock('../hooks/use-filtros-galerias', () => ({
  useFiltrosGalerias: () => ({ filtros: filtrosActuales, setFiltros: setFiltrosMock }),
}));

const galeria = (id: string, title: string) => ({
  id,
  slug: title.toLowerCase().replace(/ /g, '-'),
  title,
  eventDate: '2026-03-15',
  location: null,
  coverUrl: null,
  isFeatured: false,
  category: { id: 'c1', slug: 'bodas', name: 'Bodas' },
  mediaCount: 3,
  isPublished: true,
  updatedAt: '2026-08-26T10:00:00.000Z',
  coverType: 'REEL',
  coverDurationSec: 72,
});

const meta = (over: Record<string, unknown> = {}) => ({
  totalCount: 2,
  pageCount: 1,
  currentPage: 1,
  pageSize: 20,
  isFirstPage: true,
  isLastPage: true,
  previousPage: null,
  nextPage: null,
  ...over,
});

const envuelto = (data: unknown, m: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, meta: m, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

// El cliente se crea UNA vez por test y se reutiliza en los rerender: si se
// creara dentro del JSX, cada rerender tiraría la caché y el test de
// keepPreviousData no probaría nada.
let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  // `?nueva=true` abre el formulario, y eso vive en la URL: sin el adaptador de
  // nuqs el componente lanza. En la app lo pone el layout raíz.
  <NuqsAdapter>
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  </NuqsAdapter>
);

beforeEach(() => {
  // `?nueva=true` sobrevive entre tests del mismo fichero: sin esto, el test que
  // abre el formulario deja al siguiente empezando con la hoja ya abierta.
  window.history.replaceState(null, '', '/');
  filtrosActuales = { estado: 'todas', q: '', page: 1, pageSize: 20 };
  cliente = crearQueryClient(() => {});
  vi.clearAllMocks();
  // NO se stubea `window`: happy-dom ya trae location.origin, y sustituirlo por
  // un objeto plano rompe el `document` que usa waitFor por dentro.
});

describe('lista de galerías', () => {
  it('sin galerías muestra el estado vacío CON acción, no una tabla vacía', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(envuelto([], meta({ totalCount: 0, pageCount: 0 })))),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });

    // §9: es el momento en que James decide si la herramienta le sirve.
    expect(await screen.findByText('Aún no tienes galerías')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear la primera' })).toBeInTheDocument();
  });

  it('pinta las galerías con su categoría y su recuento', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          envuelto([galeria('g1', 'XV de Camila'), galeria('g2', 'Boda Ana')], meta()),
        ),
      ),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });

    expect(await screen.findByText('XV de Camila')).toBeInTheDocument();
    expect(screen.getByText('Boda Ana')).toBeInTheDocument();
    expect(screen.getAllByText('3 medios')).toHaveLength(2);
  });

  it('cambiar de pestaña filtra Y vuelve a la página 1', async () => {
    const usuario = userEvent.setup();
    filtrosActuales = { estado: 'todas', q: '', page: 3, pageSize: 20 };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(envuelto([galeria('g1', 'XV de Camila')], meta()))),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });
    await usuario.click(await screen.findByRole('tab', { name: 'Borradores' }));

    // El `page: 1` NO es cosmético: sin él, filtrar desde la página 3 deja una
    // lista vacía que se lee como «no hay borradores».
    expect(setFiltrosMock).toHaveBeenCalledWith({ estado: 'borradores', page: 1 });
  });

  it('el filtro viaja a la API como ?estado=, no se filtra en el cliente', async () => {
    const espia = vi.fn(() => Promise.resolve(envuelto([], meta({ totalCount: 0, pageCount: 0 }))));
    filtrosActuales = { estado: 'borradores', q: '', page: 1, pageSize: 20 };
    vi.stubGlobal('fetch', espia);

    render(<ListaGalerias />, { wrapper: Envoltorio });
    await screen.findByText('No hay borradores');

    // Hay más de una llamada (la lista y los recuentos): se busca la de la
    // lista en vez de asumir que es la primera.
    const urls = espia.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls.some((u) => u.includes('estado=borradores'))).toBe(true);
  });

  it('el buscador espera a que pares de teclear, no manda una petición por tecla', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(envuelto([galeria('g1', 'XV de Camila')], meta()))),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });
    await usuario.type(await screen.findByLabelText(/Buscar galerías/), 'cami');

    // Cuatro teclas, UNA actualización de la URL: si no, el botón atrás habría
    // que pulsarlo una vez por letra escrita.
    await waitFor(() => expect(setFiltrosMock).toHaveBeenCalledTimes(1));
    expect(setFiltrosMock).toHaveBeenCalledWith({ q: 'cami', page: 1 });
  });

  it('⌘K enfoca el buscador sin tener que apuntar con el ratón', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(envuelto([galeria('g1', 'XV de Camila')], meta()))),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });
    const buscador = await screen.findByLabelText(/Buscar galerías/);
    expect(buscador).not.toHaveFocus();

    await usuario.keyboard('{Meta>}k{/Meta}');
    expect(buscador).toHaveFocus();
  });

  it('sin resultados de búsqueda ofrece limpiarla, no el «crea la primera»', async () => {
    const usuario = userEvent.setup();
    filtrosActuales = { estado: 'todas', q: 'zzz', page: 1, pageSize: 20 };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(envuelto([], meta({ totalCount: 0, pageCount: 0 })))),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });
    expect(await screen.findByText('Nada que coincida con «zzz»')).toBeInTheDocument();
    // Ofrecerle «Crear la primera» aquí sería mentira: sí tiene galerías.
    expect(screen.queryByRole('button', { name: 'Crear la primera' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Limpiar la búsqueda' }));
    expect(setFiltrosMock).toHaveBeenCalledWith({ q: null, page: 1 });
  });

  it('las pestañas llevan su recuento, y sin recuentos NO pintan un 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          String(url).includes('/counts')
            ? new Response(
                JSON.stringify({
                  success: true,
                  code: 'OK',
                  data: { todas: 14, publicadas: 11, borradores: 3 },
                  timestamp: 'x',
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
              )
            : envuelto([galeria('g1', 'XV de Camila')], meta()),
        ),
      ),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });
    expect(await screen.findByRole('tab', { name: 'Borradores 3' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Todas 14' })).toBeInTheDocument();
  });

  it('la tarjeta dice cuándo se tocó y cuánto dura, no la fecha del evento', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(envuelto([galeria('g1', 'XV de Camila')], meta()))),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });
    await screen.findByText('XV de Camila');

    // «Bodas · Publicada hace N días»: el estado y el último cambio, que es lo
    // que James mira. La fecha del evento ya la sabe.
    expect(screen.getByText(/Bodas · Publicada hace/)).toBeInTheDocument();
    expect(screen.getByText('1:12')).toBeInTheDocument();
  });

  it('un error ofrece reintentar, no una pantalla en blanco', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              statusCode: 500,
              code: 'INTERNAL',
              message: 'Error interno',
              timestamp: 'x',
            }),
            { status: 500, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });

    // Un 500 SÍ es reintentable, así que el cliente lo intenta dos veces con
    // backoff antes de rendirse: hay que esperar a que la política se agote.
    expect(await screen.findByRole('alert', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  }, 15_000);

  it('los controles de página salen del meta, no de aritmética repetida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          envuelto(
            [galeria('g1', 'XV de Camila')],
            meta({
              totalCount: 45,
              pageCount: 3,
              currentPage: 2,
              isFirstPage: false,
              isLastPage: false,
              previousPage: 1,
              nextPage: 3,
            }),
          ),
        ),
      ),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });

    await screen.findByText('XV de Camila');
    expect(screen.getByText('Página 2 de 3 · 45 en total')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    // nextPage viene del servidor: el cliente no calcula currentPage + 1.
    expect(setFiltrosMock).toHaveBeenCalledWith({ page: 3 });
  });

  it('en la última página, Siguiente está deshabilitado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          envuelto(
            [galeria('g1', 'XV de Camila')],
            meta({
              pageCount: 2,
              currentPage: 2,
              isFirstPage: false,
              isLastPage: true,
              previousPage: 1,
              nextPage: null,
            }),
          ),
        ),
      ),
    );

    render(<ListaGalerias />, { wrapper: Envoltorio });

    await screen.findByText('XV de Camila');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
  });

  it('al cambiar de página NO vuelve al skeleton: mantiene lo anterior', async () => {
    // Sin keepPreviousData la pantalla parpadea entera en cada pulsación.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          envuelto(
            [galeria('g1', 'XV de Camila')],
            meta({
              pageCount: 3,
              currentPage: 1,
              isLastPage: false,
              nextPage: 2,
            }),
          ),
        ),
      ),
    );

    const { rerender } = render(<ListaGalerias />, { wrapper: Envoltorio });
    await screen.findByText('XV de Camila');

    filtrosActuales = { estado: 'todas', q: '', page: 2, pageSize: 20 };
    rerender(
      <Envoltorio>
        <ListaGalerias />
      </Envoltorio>,
    );

    // La galería anterior sigue en pantalla mientras llega la nueva.
    await waitFor(() => expect(screen.getByText('XV de Camila')).toBeInTheDocument());
  });
});
