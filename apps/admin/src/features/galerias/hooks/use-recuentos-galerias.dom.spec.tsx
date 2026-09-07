import { QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keys } from '@/lib/api/keys';
import { useRecuentosMenu } from '@/lib/catalogo/recuentos';
import { crearQueryClient } from '@/lib/query/cliente';
import { useRecuentosGalerias } from './use-recuentos-galerias';

const sobre = (data: unknown) => ({ success: true, code: 'OK', data, timestamp: 'x' });

let cliente = crearQueryClient(() => {});
const Marco = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  cliente = crearQueryClient(() => {});
});

/**
 * EL FALLO QUE ESTO GUARDA, y que sobrevivió al primer arreglo:
 *
 * El servidor no puede saber estos recuentos, así que su HTML sale sin ellos.
 * Si el PRIMER render del navegador —el que hidrata— ya trae el número, React
 * lo lee como una discrepancia y **descarta el árbol entero**.
 *
 * El primer intento fue `enabled: montado`, y no basta: `enabled` corta la
 * petición pero **no la lectura de caché**. Y hay caché, porque el sidebar
 * monta antes que la página y pide exactamente la misma clave. Estos tests
 * reproducen justo eso — la caché ya caliente — y miran el PRIMER valor, no el
 * último.
 */
describe('los recuentos con la caché ya caliente', () => {
  it('la primera lectura de las pestañas es undefined aunque el dato esté', async () => {
    cliente.setQueryData(
      keys.galleries.counts(),
      sobre({ todas: 14, publicadas: 11, borradores: 3 }),
    );

    const vistos: unknown[] = [];
    function Sonda() {
      vistos.push(useRecuentosGalerias());
      return null;
    }
    render(<Sonda />, { wrapper: Marco });

    // El render que hidrata: idéntico a lo que mandó el servidor.
    expect(vistos[0]).toBeUndefined();
    // Y después sí, sin haber ido a la red.
    await waitFor(() => expect(vistos.at(-1)).toEqual({ todas: 14, publicadas: 11, borradores: 3 }));
  });

  it('y la del menú también, que es quien calienta esa caché', async () => {
    cliente.setQueryData(keys.galleries.counts(), sobre({ todas: 9, publicadas: 9, borradores: 0 }));
    cliente.setQueryData(keys.categories.list(), sobre([{ id: 'a' }, { id: 'b' }]));

    const vistos: unknown[] = [];
    function Sonda() {
      vistos.push(useRecuentosMenu());
      return null;
    }
    render(<Sonda />, { wrapper: Marco });

    expect(vistos[0]).toEqual({});
    await waitFor(() => expect((vistos.at(-1) as { galerias?: number }).galerias).toBe(9));
  });
});
