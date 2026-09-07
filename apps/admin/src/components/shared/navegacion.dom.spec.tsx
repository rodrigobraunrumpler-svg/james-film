import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { Navegacion, esActivo } from './navegacion';

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function servidor() {
  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string | URL | Request) => {
      const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
      if (url.pathname === '/api/admin/galleries/counts') {
        return Promise.resolve(ok({ todas: 14, publicadas: 11, borradores: 3 }));
      }
      if (url.pathname === '/api/admin/categories') {
        return Promise.resolve(ok([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]));
      }
      if (url.pathname === '/api/admin/packages') {
        return Promise.resolve(ok([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]));
      }
      if (url.pathname === '/api/admin/testimonials') {
        return Promise.resolve(ok(Array.from({ length: 7 }, (_, i) => ({ id: `t${i}` }))));
      }
      if (url.pathname === '/api/admin/storage') {
        return Promise.resolve(ok({ usedBytes: 3.2 * 1024 ** 3, quotaBytes: 10 * 1024 ** 3 }));
      }
      return Promise.resolve(ok([]));
    }),
  );
}

let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
  cliente = crearQueryClient(() => {});
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

describe('esActivo', () => {
  it('dentro de una galería sigue marcando Galerías', () => {
    // La lista vive en `/` y el editor en `/galerias/[id]`: con comparación
    // exacta el menú se quedaría sin nada marcado justo donde James pasa el rato.
    expect(esActivo('/galerias/abc', '/')).toBe(true);
    expect(esActivo('/', '/')).toBe(true);
  });

  it('el Panel no se traga las galerías ni al revés', () => {
    expect(esActivo('/panel', '/')).toBe(false);
    expect(esActivo('/panel', '/panel')).toBe(true);
    expect(esActivo('/', '/panel')).toBe(false);
  });

  it('un prefijo parecido NO cuenta', () => {
    expect(esActivo('/paquetesx', '/paquetes')).toBe(false);
    expect(esActivo('/paquetes/nuevo', '/paquetes')).toBe(true);
  });
});

describe('el menú', () => {
  it('lleva las siete secciones, el Panel y Disponibilidad incluidos', async () => {
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });

    const menus = screen.getAllByRole('navigation', { name: 'Principal' });
    const escritorio = menus.at(-1)!;
    const etiquetas = within(escritorio)
      .getAllByRole('link')
      .map((a) => a.textContent?.replace(/\d+$/, ''));

    expect(etiquetas).toEqual([
      'Galerías',
      'Panel',
      'Categorías',
      'Paquetes',
      'Testimonios',
      'Disponibilidad',
      'Configuración',
    ]);
  });

  it('cada sección dice cuántas cosas tiene dentro', async () => {
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });

    const escritorio = screen.getAllByRole('navigation', { name: 'Principal' }).at(-1)!;
    await waitFor(() => {
      expect(within(escritorio).getByRole('link', { name: /Galerías\s*14/ })).toBeInTheDocument();
    });
    expect(within(escritorio).getByRole('link', { name: /Categorías\s*4/ })).toBeInTheDocument();
    expect(within(escritorio).getByRole('link', { name: /Testimonios\s*7/ })).toBeInTheDocument();
  });

  it('mientras carga NO pinta un cero: sería mentira', () => {
    // La petición no resuelve nunca en este test.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<Navegacion />, { wrapper: Envoltorio });

    const escritorio = screen.getAllByRole('navigation', { name: 'Principal' }).at(-1)!;
    expect(within(escritorio).queryByText('0')).not.toBeInTheDocument();
  });

  it('el buscador se abre desde el botón del menú', async () => {
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });

    expect(screen.queryByRole('textbox', { name: 'Buscar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Buscar o ir a/ })[0]!);

    expect(await screen.findByRole('textbox', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('⌘K lo abre desde cualquier sitio', async () => {
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });

    await userEvent.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findByRole('textbox', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('Ctrl+K también: no todo el mundo está en un Mac', async () => {
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });

    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('textbox', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('el botón de salir dice qué hace, no solo para el lector de pantalla', async () => {
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });

    // `aria-label` resuelve el lector de pantalla, pero no a quien MIRA: el
    // icono de salir y el de compartir son dos flechas, y averiguar cuál es
    // cuál pulsando no es una opción cuando una cierra la sesión.
    const salir = screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]!;
    const pista = salir.closest('.group\\/pista')?.querySelector('[role="tooltip"]');
    expect(pista).toHaveTextContent('Cerrar sesión');
  });

  it('el sidebar de escritorio se queda pegado a la ventana', async () => {
    servidor();
    const { container } = render(<Navegacion />, { wrapper: Envoltorio });

    // Sin esto el `aside` crecía con la página y «Cerrar sesión» quedaba al
    // fondo de doce galerías. `sticky` y no `fixed`: ocupa su hueco, así que
    // no hay que compensar el ancho a mano en el contenido.
    const aside = container.querySelector('aside')!;
    expect(aside.className).toContain('lg:sticky');
    expect(aside.className).toContain('lg:h-dvh');
    expect(aside.className).not.toContain('fixed');
  });

  it('el espacio NO se cuenta aquí: el Panel ya lo hace en su tarjeta', async () => {
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });
    await screen.findAllByRole('navigation', { name: 'Principal' });

    // Estaba en los dos sitios con dos formatos —«19 MB / 10 GB» aquí y
    // «19 MB de 10 GB» allí—: dos verdades del mismo número. El pie del menú
    // se queda con lo que de verdad se toca y recupera ~70px de alto.
    expect(screen.queryByText(/Quedan unos \d+ eventos/)).not.toBeInTheDocument();
    expect(screen.queryByText('Espacio')).not.toBeInTheDocument();
  });

  it('el interruptor de tema tiene sus tres opciones, y «sistema» es una de ellas', async () => {
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });

    const grupo = screen.getAllByRole('radiogroup', { name: 'Tema del panel' })[0]!;
    const opciones = within(grupo)
      .getAllByRole('radio')
      .map((r) => r.getAttribute('aria-label'));
    // Tres y no dos: «seguir al sistema» es el de arranque, y sin esa tercera
    // posición no habría forma de volver a él una vez elegido otro.
    expect(opciones).toEqual(['Seguir al sistema', 'Tema claro', 'Tema oscuro']);
  });

  it('elegir claro lo escribe en el <html> y lo recuerda', async () => {
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });

    const grupo = screen.getAllByRole('radiogroup', { name: 'Tema del panel' })[0]!;
    await userEvent.click(within(grupo).getByRole('radio', { name: 'Tema claro' }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    });
    expect(window.localStorage.getItem('jamesfilm:tema')).toBe('claro');
  });

  it('«seguir al sistema» BORRA la preferencia, no la guarda', async () => {
    window.localStorage.setItem('jamesfilm:tema', 'claro');
    servidor();
    render(<Navegacion />, { wrapper: Envoltorio });

    const grupo = screen.getAllByRole('radiogroup', { name: 'Tema del panel' })[0]!;
    await userEvent.click(within(grupo).getByRole('radio', { name: 'Seguir al sistema' }));

    // Se borra para que el script del <head> caiga solo en `prefers-color-scheme`
    // sin tener que interpretar un tercer valor antes del primer pintado.
    await waitFor(() => {
      expect(window.localStorage.getItem('jamesfilm:tema')).toBeNull();
    });
  });
});
