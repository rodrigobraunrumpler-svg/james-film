import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { ListaPaquetes } from './lista-paquetes';

const item = (id: string, text: string, included = true) => ({ id, text, included, order: 0 });

const paquete = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  slug: name.toLowerCase(),
  name,
  subtitle: null,
  priceAmount: 30_000,
  currency: 'PEN',
  priceNote: null,
  idealFor: null,
  icon: 'crown',
  imageUrl: null,
  badgeText: null,
  whatsappMessage: null,
  isHighlighted: false,
  items: [item(`${id}-a`, 'Siete reels')],
  isActive: true,
  order: 0,
  accentColor: null,
  categoryIds: [],
  whatsappClickCount: 0,
  ...over,
});

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function servidor(opciones: { lista?: unknown[] } = {}) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  let lista = opciones.lista ?? [
    paquete('p1', 'Básico'),
    paquete('p2', 'Pro', { isHighlighted: true }),
  ];

  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
      const metodo = init?.method ?? 'GET';
      const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      llamadas.push({ metodo, ruta: url.pathname, cuerpo });

      if (url.pathname === '/api/admin/categories') return Promise.resolve(ok([]));
      if (url.pathname === '/api/admin/icons') return Promise.resolve(ok(['crown', 'zap']));
      if (url.pathname.endsWith('/highlight')) {
        const id = url.pathname.split('/').at(-2);
        lista = lista.map((p) => ({
          ...(p as object),
          isHighlighted: (p as { id: string }).id === id,
        }));
        return Promise.resolve(ok(lista));
      }
      if (metodo === 'PATCH' && !url.pathname.endsWith('/reorder')) {
        const id = url.pathname.split('/').at(-1);
        lista = lista.map((p) =>
          (p as { id: string }).id === id ? { ...(p as object), ...(cuerpo as object) } : p,
        );
        return Promise.resolve(ok(lista.find((p) => (p as { id: string }).id === id)));
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
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>
    {children}
    <Toaster />
  </QueryClientProvider>
);

const ESPERA = { timeout: 5000 } as const;

beforeEach(() => {
  cliente = crearQueryClient(() => {});
  vi.clearAllMocks();
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

describe('lista de paquetes', () => {
  it('pinta el precio formateado desde céntimos', async () => {
    servidor({ lista: [paquete('p1', 'Básico', { priceAmount: 45_050 })] });
    render(<ListaPaquetes />, { wrapper: Envoltorio });

    // 45050 céntimos son S/ 450.50. Enteros es cómo se EDITA, no cómo se ve — y
    // el formateador normaliza el espacio DURO que mete Intl.
    expect(await screen.findByText('S/ 450.50')).toBeInTheDocument();
  });

  it('sin precio pone un guion, no «S/ 0.00»', async () => {
    servidor({ lista: [paquete('p1', 'A consultar', { priceAmount: null })] });
    render(<ListaPaquetes />, { wrapper: Envoltorio });

    await screen.findByText('A consultar');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('un punto no incluido se pinta tachado', async () => {
    servidor({ lista: [paquete('p1', 'Básico', { items: [item('i1', 'Sin drone', false)] })] });
    render(<ListaPaquetes />, { wrapper: Envoltorio });

    const punto = await screen.findByText('Sin drone');
    expect(punto.className).toContain('line-through');
  });

  it('destacar es un RADIO y es exclusivo al instante', async () => {
    // Un checkbox invitaría a marcar dos y luego a preguntarse por qué se
    // desmarcó el otro solo.
    const usuario = userEvent.setup();
    servidor();
    render(<ListaPaquetes />, { wrapper: Envoltorio });
    await screen.findByText('Básico');

    const radioBasico = screen.getByRole('radio', { name: 'Destacar Básico' });
    const radioPro = screen.getByRole('radio', { name: 'Destacar Pro' });
    expect(radioPro).toBeChecked();

    await usuario.click(radioBasico);

    // Optimista y exclusivo: ver dos destacados hasta que responda el servidor
    // sería peor que no ser optimista.
    await waitFor(() => expect(radioBasico).toBeChecked());
    expect(radioPro).not.toBeChecked();
  });

  it('ocultar el DESTACADO avisa de que la web se queda sin ninguno', async () => {
    // No falla nada: la sección simplemente sale plana.
    const usuario = userEvent.setup();
    servidor();
    render(<ListaPaquetes />, { wrapper: Envoltorio });
    await screen.findByText('Pro');

    await usuario.click(screen.getByRole('button', { name: 'Ocultar Pro' }));

    // Ya no es el `confirm()` del navegador: en iOS ese sale como un diálogo
    // del SISTEMA y se acepta con el pulgar sin leerlo.
    expect(await screen.findByText(/la web no destacará ninguno/)).toBeInTheDocument();
  });

  it('ocultar uno normal NO pregunta nada', async () => {
    const usuario = userEvent.setup();
    servidor();
    render(<ListaPaquetes />, { wrapper: Envoltorio });
    await screen.findByText('Básico');

    await usuario.click(screen.getByRole('button', { name: 'Ocultar Básico' }));

    expect(globalThis.confirm).not.toHaveBeenCalled();
  });

  it('un paquete con clics NO se intenta borrar: se avisa con el número', async () => {
    // Borrarlo pondría su packageId a null en cada clic, y son la única métrica
    // de negocio del proyecto.
    const usuario = userEvent.setup();
    const api = servidor({ lista: [paquete('p1', 'Básico', { whatsappClickCount: 12 })] });
    render(<ListaPaquetes />, { wrapper: Envoltorio });
    await screen.findByText('Básico');

    await usuario.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(api.de('DELETE', '/admin/packages')).toHaveLength(0);
    expect(await screen.findByText(/12 clics registrados/)).toBeInTheDocument();
  });

  it('sin clics sí se borra, tras confirmar', async () => {
    const usuario = userEvent.setup();
    const api = servidor({ lista: [paquete('p1', 'Sin clics')] });
    render(<ListaPaquetes />, { wrapper: Envoltorio });
    await screen.findByText('Sin clics');

    await usuario.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(api.de('DELETE', '/admin/packages/p1')).toHaveLength(0);
    await usuario.click(await screen.findByRole('button', { name: 'Borrar para siempre' }));

    await waitFor(() => expect(api.de('DELETE', '/admin/packages/p1')).toHaveLength(1), ESPERA);
  });

  it('manda TODOS los ids al reordenar', async () => {
    const usuario = userEvent.setup();
    const api = servidor();
    render(<ListaPaquetes />, { wrapper: Envoltorio });
    await screen.findByText('Básico');

    await usuario.click(screen.getByRole('button', { name: 'Mover Básico después' }));

    await waitFor(() => expect(api.de('PATCH', '/reorder')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/reorder')[0].cuerpo).toEqual({ ids: ['p2', 'p1'] });
  });
});
