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
 * Acotado a la LISTA: el filtro y las tarjetas comparten vocabulario —la
 * pastilla dice «Sin permiso» y la pestaña «Sin consentimiento»— y acotar deja
 * claro cuál de las dos se está comprobando. Antes de
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

/**
 * Editar, mover, quitar el permiso y borrar viven en el menú `⋯` de la tarjeta:
 * con los siete controles a la vista el pie eran tres filas de botones para una
 * foto y un nombre. La regla que prueba cada test no cambia, solo dónde se pulsa.
 */
async function abrirMenu(usuario: ReturnType<typeof userEvent.setup>, nombre: string) {
  await usuario.click(screen.getByRole('button', { name: `Más acciones para ${nombre}` }));
}

/** §19 y Ley 29733: es el único punto que puede traerle un problema real a James. */
describe('la puerta del consentimiento, en la interfaz', () => {
  it('sin consentimiento NO se ofrece publicar: lo único que se puede es pedir el permiso', async () => {
    // Antes «Publicar» salía deshabilitado. Ahora la acción primaria ES la que
    // toca ahora: tener las tres a la vez obligaba a leer cuál estaba
    // deshabilitada para saber en qué estado estabas.
    servidor([testimonio('t1', 'Ana')]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    expect(await screen.findByRole('button', { name: 'Dio su permiso' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
    // El motivo escrito, no un tooltip.
    expect(screen.getByText(/Sin el permiso de Ana no puede salir en la web/)).toBeInTheDocument();
    expect(enLaLista().getByText('Sin permiso')).toBeInTheDocument();
  });

  it('marcar el consentimiento pide confirmación diciendo QUÉ se afirma', async () => {
    // No un «¿seguro?»: la persona que pulsa tiene que leer qué está afirmando.
    // Y en una `Hoja`, NUNCA con `confirm()`: en iOS el nativo sale como un
    // diálogo del SISTEMA y se acepta con el pulgar sin leerlo, que es
    // exactamente el fallo del que esta confirmación tiene que proteger (§19).
    const usuario = userEvent.setup();
    servidor([testimonio('t1', 'Ana')]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    await usuario.click(screen.getByRole('button', { name: 'Dio su permiso' }));

    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/permiso para publicar su nombre, su foto y su mensaje/),
    ).toBeInTheDocument();
    // La ley que lo obliga se nombra: no es una formalidad de la app.
    expect(screen.getByText(/Ley 29733/)).toBeInTheDocument();
  });

  it('«Todavía no» NO marca el consentimiento', async () => {
    const usuario = userEvent.setup();
    const api = servidor([testimonio('t1', 'Ana')]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    await usuario.click(screen.getByRole('button', { name: 'Dio su permiso' }));
    await usuario.click(await screen.findByRole('button', { name: 'Todavía no' }));

    expect(api.de('PATCH', '/admin/testimonials/t1')).toHaveLength(0);
  });

  it('«Sí, me dio permiso» sí lo marca', async () => {
    const usuario = userEvent.setup();
    const api = servidor([testimonio('t1', 'Ana')]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    await usuario.click(screen.getByRole('button', { name: 'Dio su permiso' }));
    await usuario.click(await screen.findByRole('button', { name: 'Sí, me dio permiso' }));

    await waitFor(() => {
      expect(api.de('PATCH', '/admin/testimonials/t1')[0]?.cuerpo).toEqual({ hasConsent: true });
    });
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

    await usuario.click(screen.getByRole('button', { name: 'Dio su permiso' }));

    expect(api.de('PATCH', '/admin/testimonials')).toHaveLength(0);
  });

  it('con consentimiento, Publicar aparece', async () => {
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

    await abrirMenu(usuario, 'Ana');
    await usuario.click(screen.getByRole('button', { name: 'Quitar el permiso' }));

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
    expect(enLaLista().getByText('Sin permiso')).toBeInTheDocument();
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

    const usuario = userEvent.setup();
    await screen.findByText('Ana');
    expect(screen.getByText('Quita el filtro para poder reordenar.')).toBeInTheDocument();

    await abrirMenu(usuario, 'Bea');
    expect(screen.getByRole('button', { name: 'Mover antes' })).toBeDisabled();
  });

  it('sin filtro, el reorden funciona', async () => {
    servidor([
      testimonio('t1', 'Ana', { hasConsent: true }),
      testimonio('t2', 'Bea', { hasConsent: true }),
    ]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    const usuario = userEvent.setup();
    await screen.findByText('Ana');

    await abrirMenu(usuario, 'Bea');
    expect(screen.getByRole('button', { name: 'Mover antes' })).toBeEnabled();
  });

  it('el pie tiene TRES controles, no siete', async () => {
    servidor([testimonio('t1', 'Ana', { hasConsent: true })]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    // Acción primaria + estrella + menú. Con los siete a la vista, el pie eran
    // tres filas de botones para una foto y un nombre.
    const tarjeta = screen.getByRole('article');
    const controles = within(tarjeta)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(controles).toEqual(['Publicar', 'Destacar Ana', 'Más acciones para Ana']);
  });

  it('destacar es un botón con estado, no una etiqueta con radio escondido', async () => {
    const usuario = userEvent.setup();
    const api = servidor([testimonio('t1', 'Ana', { hasConsent: true })]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    const estrella = screen.getByRole('button', { name: 'Destacar Ana' });
    expect(estrella).toHaveAttribute('aria-pressed', 'false');
    await usuario.click(estrella);

    await waitFor(
      () => expect(api.de('PATCH', '/admin/testimonials/t1/feature')).toHaveLength(1),
      ESPERA,
    );
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
  it('exige escribir el nombre, y dice que la captura se borra del servidor', async () => {
    // Se lleva del bucket la foto de una persona real y no hay vuelta atrás:
    // el confirm() nativo se acepta con el pulgar sin leerlo.
    const usuario = userEvent.setup();
    const api = servidor([testimonio('t1', 'Ana')]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });
    await screen.findByText('Ana');

    await abrirMenu(usuario, 'Ana');
    await usuario.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(screen.getByText(/se borrarán del servidor su captura y su foto/)).toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Borrar para siempre' });
    expect(confirmar).toBeDisabled();
    expect(api.de('DELETE', '/admin/testimonials')).toHaveLength(0);

    await usuario.type(screen.getByLabelText(/Escribe/), 'Ana');
    await usuario.click(confirmar);

    await waitFor(() => expect(api.de('DELETE', '/admin/testimonials/t1')).toHaveLength(1), ESPERA);
  });

  it('la valoración se VE, no solo se rellena', async () => {
    // Estaba en el DTO y en la hoja de edición desde el principio, y no se
    // pintaba en ninguna parte: un dato que se pide y no se enseña es un dato
    // que James rellena una vez y deja de rellenar.
    servidor([testimonio('t1', 'Ana', { rating: 4 })]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    expect(await screen.findByLabelText('Valoración: 4 de 5')).toBeInTheDocument();
  });

  it('sin valoración no pinta la fila vacía', async () => {
    // Cinco estrellas apagadas dicen «valorado con cero», que es otra cosa que
    // «todavía no se ha valorado».
    servidor([testimonio('t1', 'Ana', { rating: null })]);
    render(<ListaTestimonios />, { wrapper: Envoltorio });

    await screen.findByText('Ana');
    expect(screen.queryByLabelText(/^Valoración:/)).not.toBeInTheDocument();
  });
});
