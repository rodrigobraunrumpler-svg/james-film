import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { ListaTestimonios } from './lista-testimonios';

// `import type * as` arriba, no `typeof import()` en línea: la regla
// `consistent-type-imports` prohíbe la anotación en línea.
import type * as ModuloFiltro from '../hooks/use-filtro-testimonios';

// nuqs fuera de Next: el estado de la URL se sustituye por uno en memoria.
let filtroActual: string = 'todos';
const setEstadoMock = vi.fn((e: string) => {
  filtroActual = e;
  return Promise.resolve(new URLSearchParams());
});
vi.mock('../hooks/use-filtro-testimonios', async (importar) => {
  const real = await importar<typeof ModuloFiltro>();
  return {
    ...real,
    useFiltroTestimonios: () => ({ estado: filtroActual, setEstado: setEstadoMock }),
  };
});

const testimonio = (id: string, authorName: string, over: Record<string, unknown> = {}) => ({
  id,
  format: 'SCREENSHOT',
  source: 'WHATSAPP',
  authorName,
  authorHandle: null,
  avatarUrl: null,
  eventType: 'Boda',
  eventDate: null,
  quote: 'Todo increíble',
  screenshotUrl: null,
  externalUrl: null,
  rating: null,
  galleryId: null,
  hasConsent: false,
  isActive: false,
  isFeatured: false,
  order: 0,
  ...over,
});

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function servidor(lista: unknown[]) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  let actual = lista;

  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
      const metodo = init?.method ?? 'GET';
      const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      llamadas.push({ metodo, ruta: url.pathname, cuerpo });

      if (metodo === 'PATCH' && !url.pathname.endsWith('/reorder')) {
        const id = url.pathname
          .split('/')
          .filter(Boolean)
          .at(url.pathname.endsWith('/feature') ? -2 : -1);
        actual = actual.map((t) =>
          (t as { id: string }).id === id ? { ...(t as object), ...(cuerpo as object) } : t,
        );
        return Promise.resolve(ok(actual.find((t) => (t as { id: string }).id === id)));
      }
      return Promise.resolve(ok(actual));
    }),
  );

  return {
    de: (metodo: string, fragmento: string) =>
      llamadas.filter((l) => l.metodo === metodo && l.ruta.includes(fragmento)),
  };
}

let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>
    {children}
    <Toaster />
  </QueryClientProvider>
);

const ESPERA = { timeout: 5000 } as const;

/**
 * Acotado a la LISTA: «Sin consentimiento» es a la vez la etiqueta de estado de
 * una tarjeta y el nombre de un botón del filtro. Buscar en toda la pantalla
 * encuentra los dos.
 */
const enLaLista = () => within(screen.getByRole('list'));

beforeEach(() => {
  cliente = crearQueryClient(() => {});
  filtroActual = 'todos';
  vi.clearAllMocks();
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

/** §19 y Ley 29733: es el único punto que puede traerle un problema real a James. */
describe('la puerta del consentimiento, en la interfaz', () => {
  it('sin consentimiento, Publicar sale DESHABILITADO y con el motivo escrito', async () => {
    // Deshabilitado y no oculto: si desaparece, no se entiende por qué.
    servidor([testimonio('t1', 'Ana')]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeDisabled();
    expect(screen.getByText(/hasta que confirmes que Ana dio su permiso/)).toBeInTheDocument();
    expect(enLaLista().getByText('Sin consentimiento')).toBeInTheDocument();
  });

  it('marcar el consentimiento pide confirmación diciendo QUÉ se afirma', async () => {
    // No un «¿seguro?»: la persona que pulsa tiene que leer qué está afirmando.
    const usuario = userEvent.setup();
    servidor([testimonio('t1', 'Ana')]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    await usuario.click(screen.getByRole('button', { name: 'Marcar consentimiento' }));

    expect(globalThis.confirm).toHaveBeenCalledWith(
      expect.stringContaining('permiso para publicar su nombre, su foto y su mensaje'),
    );
  });

  it('si se cancela la confirmación, NO se marca', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    const api = servidor([testimonio('t1', 'Ana')]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    await usuario.click(screen.getByRole('button', { name: 'Marcar consentimiento' }));

    expect(api.de('PATCH', '/admin/testimonials')).toHaveLength(0);
  });

  it('con consentimiento, Publicar se habilita', async () => {
    servidor([testimonio('t1', 'Ana', { hasConsent: true })]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeEnabled();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });

  it('quitar el consentimiento despublica a la vez, o el servidor lo rechazaría', async () => {
    const usuario = userEvent.setup();
    const api = servidor([testimonio('t1', 'Ana', { hasConsent: true, isActive: true })]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    await usuario.click(screen.getByRole('button', { name: 'Quitar consentimiento' }));

    await waitFor(() => expect(api.de('PATCH', '/admin/testimonials/t1')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/admin/testimonials/t1')[0].cuerpo).toEqual({
      hasConsent: false,
      isActive: false,
    });
  });
});

describe('estados y filtro', () => {
  it('distingue los tres estados de un vistazo', async () => {
    servidor([
      testimonio('t1', 'Ana'),
      testimonio('t2', 'Bea', { hasConsent: true }),
      testimonio('t3', 'Cris', { hasConsent: true, isActive: true }),
    ]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    await screen.findByText('Ana');
    expect(enLaLista().getByText('Sin consentimiento')).toBeInTheDocument();
    expect(enLaLista().getByText('Borrador')).toBeInTheDocument();
    expect(enLaLista().getByText('Publicado')).toBeInTheDocument();
  });

  it('con filtro activo el reorden se DESHABILITA, con el motivo escrito', async () => {
    // ReorderService numera solo los ids que recibe: reordenar un subconjunto
    // dejaría a los invisibles con órdenes que colisionan y la lista pública
    // saldría barajada, sin ningún error.
    filtroActual = 'publicados';
    servidor([
      testimonio('t1', 'Ana', { hasConsent: true, isActive: true }),
      testimonio('t2', 'Bea', { hasConsent: true, isActive: true }),
    ]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    await screen.findByText('Ana');
    expect(screen.getByText('Quita el filtro para poder reordenar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mover Bea antes' })).toBeDisabled();
  });

  it('sin filtro, el reorden funciona', async () => {
    servidor([
      testimonio('t1', 'Ana', { hasConsent: true }),
      testimonio('t2', 'Bea', { hasConsent: true }),
    ]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    await screen.findByText('Ana');
    expect(screen.getByRole('button', { name: 'Mover Bea antes' })).toBeEnabled();
  });

  it('el filtro esconde lo que no cumple', async () => {
    filtroActual = 'sin-consentimiento';
    servidor([testimonio('t1', 'Ana'), testimonio('t2', 'Bea', { hasConsent: true })]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText('Bea')).not.toBeInTheDocument();
  });
});

describe('borrado', () => {
  it('avisa de que la captura se borra del servidor', async () => {
    const usuario = userEvent.setup();
    const api = servidor([testimonio('t1', 'Ana')]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    await usuario.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(globalThis.confirm).toHaveBeenCalledWith(
      expect.stringContaining('se borrará su captura del servidor'),
    );
    await waitFor(() => expect(api.de('DELETE', '/admin/testimonials/t1')).toHaveLength(1), ESPERA);
  });
});
