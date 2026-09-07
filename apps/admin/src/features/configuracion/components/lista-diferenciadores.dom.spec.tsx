import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { ListaDiferenciadores } from './lista-diferenciadores';

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const DIF = {
  id: 'd1',
  title: 'Calidad profesional',
  subtitle: 'Cámara, luz y audio propios.',
  icon: 'camera',
  isActive: true,
  order: 0,
};

function servidor() {
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
      if (url.pathname === '/api/admin/differentiators') return Promise.resolve(ok([DIF]));
      if (url.pathname === '/api/admin/icons') return Promise.resolve(ok(['camera', 'zap']));
      return Promise.resolve(ok(DIF));
    }),
  );
  return llamadas;
}

const Marco = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={crearQueryClient(() => {})}>{children}</QueryClientProvider>
);

beforeEach(() => vi.unstubAllGlobals());

describe('editar un diferenciador', () => {
  /**
   * El fallo que esto guarda: la fila traía subir, bajar, ocultar y borrar, y
   * NINGÚN editar. Para cambiar una coma del subtítulo había que borrarlo y
   * volver a escribirlo entero, perdiendo su sitio en el orden.
   */
  it('el lápiz abre la fila y guarda con PATCH sobre ese id', async () => {
    const llamadas = servidor();
    const usuario = userEvent.setup();
    render(<ListaDiferenciadores />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: 'Editar Calidad profesional' }));

    // Acotado por el id del campo: el formulario de «Añadir» de abajo y la
    // vista previa de la derecha también tienen «Título» y `<li>`s.
    const titulo = screen.getByLabelText('Título', { selector: '#dif-t-d1' });
    const fila = titulo.closest('li')!;
    expect(titulo).toHaveValue('Calidad profesional');
    await usuario.clear(titulo);
    await usuario.type(titulo, 'Calidad de verdad');
    await usuario.click(within(fila).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      const patch = llamadas.find((l) => l.metodo === 'PATCH');
      expect(patch?.ruta).toBe('/api/admin/differentiators/d1');
      expect(patch?.cuerpo).toMatchObject({ title: 'Calidad de verdad' });
    });
  });

  it('vaciar el subtítulo lo BORRA: manda null, no una cadena vacía', async () => {
    const llamadas = servidor();
    const usuario = userEvent.setup();
    render(<ListaDiferenciadores />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: 'Editar Calidad profesional' }));
    const subtitulo = screen.getByLabelText('Subtítulo', { selector: '#dif-s-d1' });
    const fila = subtitulo.closest('li')!;
    await usuario.clear(subtitulo);
    await usuario.click(within(fila).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      const patch = llamadas.find((l) => l.metodo === 'PATCH');
      expect(patch).toBeDefined();
      expect((patch!.cuerpo as { subtitle: unknown }).subtitle).toBeNull();
    });
  });

  it('cancelar no manda nada y devuelve la fila a como estaba', async () => {
    const llamadas = servidor();
    const usuario = userEvent.setup();
    render(<ListaDiferenciadores />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: 'Editar Calidad profesional' }));
    const titulo = screen.getByLabelText('Título', { selector: '#dif-t-d1' });
    const fila = titulo.closest('li')!;
    await usuario.type(titulo, 'xxx');
    await usuario.click(within(fila).getByRole('button', { name: 'Cancelar' }));

    // La fila vuelve a ser de lectura: el lápiz está otra vez y el campo no.
    // (`findByText` no vale: la vista previa de la derecha pinta el mismo texto.)
    expect(
      await screen.findByRole('button', { name: 'Editar Calidad profesional' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Título', { selector: '#dif-t-d1' })).toBeNull();
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
  });
});
