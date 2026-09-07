import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navegacion } from '../../../../vitest.setup.dom';
import { crearQueryClient } from '@/lib/query/cliente';
import { BuscadorGlobal } from './buscador-global';

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const RESULTADOS = [
  {
    kind: 'GALLERY',
    id: 'g1',
    label: 'XV de Camila',
    hint: 'Borrador',
    href: '/galerias/g1',
    coverUrl: null,
  },
  {
    kind: 'GALLERY',
    id: 'g2',
    label: 'Cumple de Nico',
    hint: '12 medios',
    href: '/galerias/g2',
    coverUrl: null,
  },
  {
    kind: 'PACKAGE',
    id: 'p1',
    label: 'Pro',
    hint: 'El más pedido',
    href: '/paquetes',
    coverUrl: null,
  },
];

function servidor(datos: unknown = RESULTADOS) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string | URL | Request) => {
      urls.push(String(entrada instanceof Request ? entrada.url : entrada));
      return Promise.resolve(ok(datos));
    }),
  );
  return urls;
}

let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
);

/**
 * happy-dom no implementa `showModal()` ni `close()` — son del modo modal del
 * navegador, no del DOM. Se sustituyen por lo que sí es observable: el atributo
 * `open`, que es lo que decide si el contenido está en el árbol.
 */
beforeEach(() => {
  vi.restoreAllMocks();
  cliente = crearQueryClient(() => {});

  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

const abrir = () => render(<BuscadorGlobal abierto alCerrar={vi.fn()} />, { wrapper: Envoltorio });

describe('el buscador ⌘K', () => {
  it('sin escribir nada ofrece a dónde ir y qué hacer, no una caja vacía', () => {
    servidor();
    abrir();

    expect(screen.getByText('Galerías')).toBeInTheDocument();
    expect(screen.getByText('Panel')).toBeInTheDocument();
    // Dos grupos: a dónde ir y qué hacer. El prototipo los separa a propósito.
    expect(screen.getByText('Hacer')).toBeInTheDocument();
    expect(screen.getByText('Nueva galería')).toBeInTheDocument();
  });

  it('escribir «ajustes» encuentra Configuración, aunque no se llame así', () => {
    servidor([]);
    abrir();

    // El atajo solo sirve si NO hace falta saber cómo se llama la pantalla:
    // eso es justo lo que no sabes cuando te pierdes.
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar' }), {
      target: { value: 'ajustes' },
    });

    expect(screen.getByText('Configuración › Contacto')).toBeInTheDocument();
  });

  it('encuentra sin acentos: «configuracion» casa con «Configuración»', () => {
    servidor([]);
    abrir();

    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar' }), {
      target: { value: 'configuracion' },
    });

    expect(screen.getByText('Configuración › SEO')).toBeInTheDocument();
  });

  it('las acciones también se buscan: «publicar» no, «crear» sí', () => {
    servidor([]);
    abrir();

    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar' }), {
      target: { value: 'crear' },
    });

    expect(screen.getByText('Hacer')).toBeInTheDocument();
    expect(screen.getByText('Nueva galería')).toBeInTheDocument();
  });

  it('con una sola letra no consulta al servidor y lo dice', async () => {
    const urls = servidor();
    abrir();

    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar' }), 'a');

    expect(await screen.findByText('Escribe al menos dos letras')).toBeInTheDocument();
    // Con una letra «a» casa con casi todo: sería un scan de cuatro tablas por tecla.
    expect(urls.filter((u) => u.includes('/admin/search'))).toHaveLength(0);
  });

  it('con dos letras busca y agrupa por tipo', async () => {
    servidor();
    abrir();

    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar' }), 'cam');

    expect(await screen.findByText('XV de Camila')).toBeInTheDocument();
    expect(screen.getByText('Galerías')).toBeInTheDocument();
    expect(screen.getByText('Paquetes')).toBeInTheDocument();
  });

  it('el estado de la galería se ve en el resultado', async () => {
    servidor();
    abrir();

    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar' }), 'cam');
    await screen.findByText('XV de Camila');

    // Lo primero que hay que saber de una galería es si está en vivo.
    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });

  it('las flechas mueven el resaltado y Enter navega a lo resaltado', async () => {
    servidor();
    const cerrar = vi.fn();
    render(<BuscadorGlobal abierto alCerrar={cerrar} />, { wrapper: Envoltorio });

    const caja = screen.getByRole('textbox', { name: 'Buscar' });
    await userEvent.type(caja, 'cam');
    await screen.findByText('XV de Camila');

    await userEvent.keyboard('{ArrowDown}');
    const opciones = screen.getAllByRole('option');
    expect(opciones[1]).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{Enter}');
    expect(navegacion.push).toHaveBeenCalledWith('/galerias/g2');
    expect(cerrar).toHaveBeenCalled();
  });

  it('la flecha arriba desde el primero da la vuelta al último', async () => {
    servidor();
    abrir();

    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar' }), 'cam');
    await screen.findByText('XV de Camila');

    await userEvent.keyboard('{ArrowUp}');
    const opciones = screen.getAllByRole('option');
    expect(opciones.at(-1)).toHaveAttribute('aria-selected', 'true');
  });

  it('pulsar un resultado navega y cierra', async () => {
    servidor();
    const cerrar = vi.fn();
    render(<BuscadorGlobal abierto alCerrar={cerrar} />, { wrapper: Envoltorio });

    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar' }), 'cam');
    await userEvent.click(await screen.findByText('Pro'));

    expect(navegacion.push).toHaveBeenCalledWith('/paquetes');
    expect(cerrar).toHaveBeenCalled();
  });

  it('sin resultados lo dice con el término buscado', async () => {
    servidor([]);
    abrir();

    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar' }), 'zzz');
    expect(await screen.findByText(/Nada que case con «zzz»/)).toBeInTheDocument();
  });

  it('cerrado no renderiza el contenido', () => {
    servidor();
    render(<BuscadorGlobal abierto={false} alCerrar={vi.fn()} />, { wrapper: Envoltorio });

    expect(screen.queryByRole('textbox', { name: 'Buscar' })).not.toBeInTheDocument();
  });

  it('Enter sin nada resaltado no navega a ninguna parte', async () => {
    servidor([]);
    abrir();

    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar' }), 'zzz');
    await screen.findByText(/Nada que case/);
    await userEvent.keyboard('{Enter}');

    expect(navegacion.push).not.toHaveBeenCalled();
  });

  it('al reducirse los resultados el resaltado NO apunta a una fila que ya no existe', async () => {
    servidor();
    abrir();

    const caja = screen.getByRole('textbox', { name: 'Buscar' });
    await userEvent.type(caja, 'cam');
    await screen.findByText('XV de Camila');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');

    vi.mocked(fetch).mockResolvedValue(ok([RESULTADOS[0]]));
    await userEvent.type(caja, 'ila');

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });
});
