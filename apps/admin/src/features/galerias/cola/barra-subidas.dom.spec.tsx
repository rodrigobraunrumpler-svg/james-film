import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { BarraSubidas } from './barra-subidas';
import { cola } from './store';

const archivo = (nombre: string, size: number) => {
  const f = new File([new Uint8Array(8)], nombre, { type: 'video/mp4' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
);

beforeEach(() => {
  cliente = crearQueryClient(() => {});
  cola.store.setState({ items: {} });
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});

/** Un item ya en vuelo, sin arrancar la máquina: aquí se prueba la BARRA. */
const enVuelo = (id: string, size: number, bytesSubidos = 0) => ({
  clientUploadId: id,
  identidad: id,
  galleryId: 'g1',
  archivo: archivo(`${id}.mp4`, size),
  tipo: 'REEL' as const,
  estado: 'SUBIENDO' as const,
  progreso: bytesSubidos / size,
  bytesSubidos,
  mediaId: null,
  motivo: null,
  intentos: 0,
  empezoEn: 0,
});

describe('barra de subidas', () => {
  it('sin nada en curso no ocupa sitio', () => {
    const { container } = render(<BarraSubidas />, { wrapper: Envoltorio });
    expect(container).toBeEmptyDOMElement();
  });

  it('se monta con una subida viva sin caerse en un bucle de renders', async () => {
    // El fallo que este test existe para cazar: con el selector devolviendo un
    // objeto derivado, useSyncExternalStore veía un snapshot distinto en cada
    // lectura y React tumbaba la pantalla con «Maximum update depth exceeded».
    // Solo ocurría con la barra visible, o sea durante una subida de verdad.
    cola.store.setState({ items: { a: enVuelo('a', 1000, 250) } });

    render(<BarraSubidas />, { wrapper: Envoltorio });

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });

  it('cuenta archivos y bytes del lote entero, no del que va subiendo', async () => {
    cola.store.setState({
      items: {
        a: { ...enVuelo('a', 1000, 1000), estado: 'LISTO', progreso: 1 },
        b: enVuelo('b', 1000, 500),
        c: enVuelo('c', 2000, 0),
      },
    });

    render(<BarraSubidas />, { wrapper: Envoltorio });

    // Sin el total del lote, James no sabe cuánto le queda por gastar de datos.
    expect(await screen.findByText(/Subiendo 2 de 3/)).toBeInTheDocument();
  });

  it('desaparece cuando todo termina', async () => {
    cola.store.setState({ items: { a: enVuelo('a', 1000, 500) } });
    const { container } = render(<BarraSubidas />, { wrapper: Envoltorio });
    await screen.findByRole('status');

    cola.store.setState({
      items: { a: { ...enVuelo('a', 1000, 1000), estado: 'LISTO', progreso: 1 } },
    });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
