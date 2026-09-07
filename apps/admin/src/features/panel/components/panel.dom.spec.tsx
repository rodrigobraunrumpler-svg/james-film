import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { Panel } from './panel';

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const serie = (cuentas: number[]) =>
  cuentas.map((count, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    count,
  }));

const resumen = (over: Record<string, unknown> = {}) => ({
  attention: [],
  clicks: {
    total: 47,
    previousTotal: 35,
    daily: serie(Array.from({ length: 30 }, (_, i) => i % 4)),
    byPackage: [
      { packageId: 'p1', packageName: 'Pro', count: 24 },
      { packageId: 'p2', packageName: 'Básico', count: 11 },
      { packageId: 'p3', packageName: 'Premium', count: 6 },
    ],
    noPackage: 6,
    bySource: [
      { source: 'paquetes' as const, clicks: 20 },
      { source: 'calendario-ocupado' as const, clicks: 5 },
    ],
  },
  storage: { usedBytes: 3.2 * 1024 ** 3, quotaBytes: 10 * 1024 ** 3 },
  deploy: { status: 'IDLE', pendingChanges: 3, error: null, finishedAt: null },
  ultimaGaleria: { id: 'g1', title: 'XV de Camila' },
  saturdays: [
    { month: '2026-09-01', free: 2, total: 4 },
    { month: '2026-10-01', free: 5, total: 5 },
    { month: '2026-11-01', free: 4, total: 4 },
  ],
  ...over,
});

const aviso = (over: Record<string, unknown> = {}) => ({
  id: 'media:g1:2',
  kind: 'MEDIA_FAILED',
  title: '2 archivos no llegaron a subirse',
  detail: 'En «XV de Camila»',
  href: '/galerias/g1',
  accion: 'Ver la galería',
  coverUrl: null,
  galleryId: 'g1',
  grave: false,
  since: null,
  ...over,
});

function servidor(datos: unknown = resumen()) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(ok(datos))),
  );
}

let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  cliente = crearQueryClient(() => {});
});

describe('el panel', () => {
  it('pinta el número de clics y la variación contra la ventana anterior', async () => {
    servidor();
    render(<Panel />, { wrapper: Envoltorio });

    expect(await screen.findByText('47')).toBeInTheDocument();
    // Un número solo no dice si sube o baja.
    expect(screen.getByText(/12 más que antes/)).toBeInTheDocument();
  });

  it('no pinta la variación cuando no ha cambiado nada', async () => {
    servidor(resumen({ clicks: { ...resumen().clicks, total: 35, previousTotal: 35 } }));
    render(<Panel />, { wrapper: Envoltorio });

    await screen.findByText('35');
    expect(screen.queryByText(/más que antes|menos que antes/)).not.toBeInTheDocument();
  });

  it('el reparto por paquete lleva sus nombres y su recuento', async () => {
    servidor();
    render(<Panel />, { wrapper: Envoltorio });

    const bloque = await screen.findByLabelText('Clics a WhatsApp');
    expect(within(bloque).getByText('Pro')).toBeInTheDocument();
    expect(within(bloque).getByText('24')).toBeInTheDocument();
    // Los clics del hero y el pie no se pierden: tienen su tramo.
    expect(within(bloque).getByText('Sin paquete')).toBeInTheDocument();
  });

  it('la lectura solo sale cuando el reparto es DESIGUAL de verdad', async () => {
    servidor();
    render(<Panel />, { wrapper: Envoltorio });
    // 6 contra 24: el último no llega ni a un tercio del primero.
    expect(await screen.findByText(/El Premium lleva 6 contra 24 del Pro/)).toBeInTheDocument();
  });

  it('con el reparto parejo NO sale: escribirla siempre la vuelve ruido', async () => {
    servidor(
      resumen({
        clicks: {
          ...resumen().clicks,
          byPackage: [
            { packageId: 'p1', packageName: 'Pro', count: 12 },
            { packageId: 'p2', packageName: 'Básico', count: 10 },
          ],
        },
      }),
    );
    render(<Panel />, { wrapper: Envoltorio });

    await screen.findByText('47');
    expect(screen.queryByText(/O no se ve, o el precio asusta/)).not.toBeInTheDocument();
  });

  it('sin avisos dice que todo está en orden, no deja el hueco vacío', async () => {
    servidor();
    render(<Panel />, { wrapper: Envoltorio });

    expect(await screen.findByText(/Todo en orden/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Requiere tu atención')).not.toBeInTheDocument();
  });

  it('cada aviso lleva su acción, y la acción es un enlace a esa galería', async () => {
    servidor(resumen({ attention: [aviso()] }));
    render(<Panel />, { wrapper: Envoltorio });

    const bloque = await screen.findByLabelText('Requiere tu atención');
    const enlace = within(bloque).getByRole('link', { name: 'Ver la galería' });
    expect(enlace).toHaveAttribute('href', '/galerias/g1');
  });

  it('los tres tipos de aviso se distinguen POR EL FILO, no solo por el texto', async () => {
    servidor(
      resumen({
        attention: [
          aviso({ id: 'd', kind: 'DEPLOY_FAILED', grave: true, galleryId: null }),
          aviso({ id: 'm', kind: 'MEDIA_FAILED' }),
          aviso({ id: 's', kind: 'STALE_DRAFT' }),
        ],
      }),
    );
    render(<Panel />, { wrapper: Envoltorio });

    const filas = within(await screen.findByLabelText('Requiere tu atención')).getAllByRole(
      'listitem',
    );
    // Con solo `grave` las dos últimas quedaban idénticas y la crítica perdía
    // intensidad: rojo lo que ya salió mal en la web, latón lo que hay que
    // mirar, línea normal el recordatorio.
    expect(filas[0]!.className).toContain('border-l-danger');
    expect(filas[1]!.className).toContain('border-l-brass');
    expect(filas[2]!.className).toContain('border-l-line-strong');
  });

  it('un aviso con instante dice cuánto lleva así', async () => {
    const hace2h = new Date(Date.now() - 2 * 3_600_000).toISOString();
    servidor(
      resumen({
        attention: [aviso({ kind: 'DEPLOY_FAILED', grave: true, galleryId: null, since: hace2h })],
      }),
    );
    render(<Panel />, { wrapper: Envoltorio });

    // Cuánto lleva roto es parte de qué está roto.
    expect(await screen.findByText(/hace 2 horas/)).toBeInTheDocument();
  });

  it('descartar un aviso lo quita y lo recuerda en localStorage', async () => {
    servidor(resumen({ attention: [aviso()] }));
    render(<Panel />, { wrapper: Envoltorio });

    const bloque = await screen.findByLabelText('Requiere tu atención');
    await userEvent.click(within(bloque).getByRole('button', { name: /Descartar: 2 archivos/ }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Requiere tu atención')).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem('jamesfilm:avisos-descartados')).toContain('media:g1:2');
  });

  it('un aviso ya descartado no vuelve a aparecer al recargar', async () => {
    window.localStorage.setItem('jamesfilm:avisos-descartados', JSON.stringify(['media:g1:2']));
    servidor(resumen({ attention: [aviso()] }));
    render(<Panel />, { wrapper: Envoltorio });

    expect(await screen.findByText(/Todo en orden/)).toBeInTheDocument();
  });

  it('un localStorage manipulado a mano no tumba la pantalla', async () => {
    window.localStorage.setItem('jamesfilm:avisos-descartados', 'no-es-json{');
    servidor(resumen({ attention: [aviso()] }));
    render(<Panel />, { wrapper: Envoltorio });

    expect(await screen.findByLabelText('Requiere tu atención')).toBeInTheDocument();
  });

  it('el atajo de subir apunta a la última galería tocada', async () => {
    servidor();
    render(<Panel />, { wrapper: Envoltorio });

    const atajos = await screen.findByLabelText('Atajos');
    expect(within(atajos).getByRole('link', { name: /Subir a «XV de Camila»/ })).toHaveAttribute(
      'href',
      '/galerias/g1',
    );
  });

  it('sin ninguna galería, el atajo de subir NO se pinta: llevaría a un 404', async () => {
    servidor(resumen({ ultimaGaleria: null }));
    render(<Panel />, { wrapper: Envoltorio });

    const atajos = await screen.findByLabelText('Atajos');
    expect(within(atajos).queryByRole('link', { name: /Subir a/ })).not.toBeInTheDocument();
  });

  it('sin cambios pendientes no se ofrece publicar: sería un botón que no hace nada', async () => {
    servidor(
      resumen({ deploy: { status: 'IDLE', pendingChanges: 0, error: null, finishedAt: null } }),
    );
    render(<Panel />, { wrapper: Envoltorio });

    const atajos = await screen.findByLabelText('Atajos');
    expect(within(atajos).queryByRole('button', { name: /Publicar/ })).not.toBeInTheDocument();
  });

  it('el espacio se dice en EVENTOS, que es lo que James entiende', async () => {
    servidor();
    render(<Panel />, { wrapper: Envoltorio });

    const espacio = await screen.findByLabelText('Espacio');
    expect(within(espacio).getByText(/Quedan unos \d+ eventos/)).toBeInTheDocument();
  });

  it('un fallo de carga ofrece reintentar, no empuja a crear algo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('sin red'))),
    );
    render(<Panel />, { wrapper: Envoltorio });

    expect(
      await screen.findByText('No se pudo cargar el panel', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('lo que el Panel no decía', () => {
  /**
   * De DÓNDE salieron es otra pregunta que de qué paquete, y el Panel solo
   * contestaba la segunda: sin esto no había forma de saber si el calendario
   * —o la línea de Negocios, que es medio producto— trae gente.
   */
  it('reparte los clics por fuente, con su porcentaje', async () => {
    servidor(resumen());
    render(<Panel />, { wrapper: Envoltorio });

    expect(await screen.findByText('De dónde salieron')).toBeInTheDocument();
    expect(screen.getByText('Calendario · día cogido')).toBeInTheDocument();
    // 5 de 25 = 20 %. Sin el porcentaje, «5» no dice nada sobre cuánto es.
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('los sábados libres se ven al abrir, con salida al calendario', async () => {
    servidor(resumen());
    render(<Panel />, { wrapper: Envoltorio });

    const tarjeta = await screen.findByRole('region', { name: 'Sábados libres' });
    expect(within(tarjeta).getByText('2 de 4')).toBeInTheDocument();
    expect(within(tarjeta).getByRole('link', { name: 'Ver el calendario' })).toHaveAttribute(
      'href',
      '/disponibilidad',
    );
  });

  it('sin ningún sábado por delante lo DICE, no deja el hueco', async () => {
    servidor(
      resumen({
        saturdays: [
          { month: '2026-09-01', free: 0, total: 0 },
          { month: '2026-10-01', free: 0, total: 0 },
          { month: '2026-11-01', free: 0, total: 0 },
        ],
      }),
    );
    render(<Panel />, { wrapper: Envoltorio });

    expect(
      await screen.findByText('No quedan sábados por delante este trimestre.'),
    ).toBeInTheDocument();
  });
});
