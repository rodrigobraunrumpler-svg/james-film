import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster, toast } from 'sonner';
import { crearQueryClient } from '@/lib/query/cliente';
import { hoyEnLima, masDias } from '../fechas';
import { PantallaDisponibilidad } from './pantalla-disponibilidad';

/**
 * Las fechas se calculan contra el HOY real y no con relojes falsos.
 *
 * El componente pregunta la hora de Lima por su cuenta, y congelarla obliga a
 * temporizadores falsos que se pelean con `userEvent`. Con fechas relativas el
 * test dice lo mismo y no tiene reloj que sincronizar.
 */
const HOY = hoyEnLima();
const dentroDe = (dias: number) => masDias(HOY, dias);

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const RESUMEN = {
  proximas: [{ id: 'g1', from: dentroDe(10), to: dentroDe(11), note: 'Boda de Ana' }],
  masPedidas: [
    { date: dentroDe(10), count: 3, busy: true },
    { date: dentroDe(20), count: 1, busy: false },
  ],
  sabados: [{ month: `${HOY.slice(0, 7)}-01`, free: 2, total: 4 }],
  sinGaleria: [{ id: 'g0', from: dentroDe(-20), to: dentroDe(-20), note: 'XV de Rosa' }],
  clicks: { free: 5, busy: 3 },
  updatedAt: null,
};

function servidor(dias: { date: string; note: string | null; groupId: string | null }[] = []) {
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
      if (url.pathname === '/api/admin/availability/summary') return Promise.resolve(ok(RESUMEN));
      if (url.pathname === '/api/admin/availability') return Promise.resolve(ok(dias));
      return Promise.resolve(ok([]));
    }),
  );
  return llamadas;
}

const Marco = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={crearQueryClient(() => {})}>
    {children}
    {/* El `Toaster` de verdad: «Deshacer» vive dentro de un toast, y sin él
        el test pasaría sin haber comprobado la única salida de un error. */}
    <Toaster />
  </QueryClientProvider>
);

const dia = (iso: string, estado: 'libre' | 'ocupado') =>
  screen.getByRole('button', { name: `${iso} · ${estado}` });

beforeEach(() => {
  vi.unstubAllGlobals();
  /**
   * El almacén de `sonner` es un singleton de módulo y SOBREVIVE entre tests:
   * el toast de «Deshacer» de un test aparecía en el siguiente y hacía fallar
   * un `queryAllByRole` que era correcto. Es la misma trampa que la cola de
   * subidas, y se cierra igual — vaciando lo que persiste.
   */
  toast.dismiss();
});

describe('marcar una reserva', () => {
  /**
   * El caso que originó el módulo: «quiero para dos días, 24 y 25 de octubre».
   * Los dos días tienen que viajar en UN `PUT` para que la API les dé el mismo
   * grupo; en dos llamadas serían dos reservas distintas.
   */
  it('tocar el primer día y el último manda el RANGO entero en una sola llamada', async () => {
    const llamadas = servidor();
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: `${dentroDe(3)} · libre` }));
    await usuario.click(dia(dentroDe(5), 'libre'));

    expect(screen.getByText(/3 días/)).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Nota privada'), 'Boda de Ana');
    await usuario.click(screen.getByRole('button', { name: 'Marcar como ocupado' }));

    await waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT');
      expect(put?.ruta).toBe('/api/admin/availability');
      expect(put?.cuerpo).toEqual({
        dates: [dentroDe(3), dentroDe(4), dentroDe(5)],
        busy: true,
        note: 'Boda de Ana',
      });
    });
  });

  it('tocarlos del revés da el mismo rango: se elige el último primero a menudo', async () => {
    const llamadas = servidor();
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: `${dentroDe(5)} · libre` }));
    await usuario.click(dia(dentroDe(3), 'libre'));
    await usuario.click(screen.getByRole('button', { name: 'Marcar como ocupado' }));

    await waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT');
      expect(put).toBeDefined();
      expect((put!.cuerpo as { dates: string[] }).dates).toEqual([
        dentroDe(3),
        dentroDe(4),
        dentroDe(5),
      ]);
    });
  });

  it('el tercer toque REINICIA la selección: es «me equivoqué», no «amplía»', async () => {
    servidor();
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: `${dentroDe(3)} · libre` }));
    await usuario.click(dia(dentroDe(5), 'libre'));
    await usuario.click(dia(dentroDe(8), 'libre'));

    expect(screen.getByText(/1 día/)).toBeInTheDocument();
  });

  it('volver a tocar el mismo día suelto la selección', async () => {
    servidor();
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    const uno = await screen.findByRole('button', { name: `${dentroDe(3)} · libre` });
    await usuario.click(uno);
    expect(screen.getByRole('button', { name: 'Marcar como ocupado' })).toBeInTheDocument();
    await usuario.click(uno);
    expect(screen.queryByRole('button', { name: 'Marcar como ocupado' })).toBeNull();
  });
});

describe('liberar', () => {
  it('si TODO lo elegido está ocupado, la acción es liberar y no pide nota', async () => {
    const llamadas = servidor([
      { date: dentroDe(3), note: 'Boda de Ana', groupId: 'g1' },
      { date: dentroDe(4), note: 'Boda de Ana', groupId: 'g1' },
    ]);
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: `${dentroDe(3)} · ocupado` }));
    await usuario.click(dia(dentroDe(4), 'ocupado'));

    await usuario.click(screen.getByRole('button', { name: 'Liberar estos días' }));

    await waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT');
      expect(put).toBeDefined();
      expect(put!.cuerpo).toMatchObject({ busy: false });
      expect((put!.cuerpo as { dates: string[] }).dates).toEqual([dentroDe(3), dentroDe(4)]);
    });
  });

  it('con un día libre dentro del rango vuelve a ser marcar, no liberar', async () => {
    servidor([{ date: dentroDe(3), note: null, groupId: 'g1' }]);
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: `${dentroDe(3)} · ocupado` }));
    await usuario.click(dia(dentroDe(5), 'libre'));

    expect(screen.getByRole('button', { name: 'Marcar como ocupado' })).toBeInTheDocument();
  });
});

describe('mientras carga', () => {
  /**
   * El fallo que esto guarda: con la petición en vuelo, la columna de la
   * derecha pintaba «Nada cogido por delante. Todo libre.» — una frase, no un
   * hueco, y decía lo contrario de lo que puede ser cierto un segundo después.
   */
  it('NO dice que no hay nada: eso sería mentira hasta que llegue el dato', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    expect(screen.queryByText('Nada cogido por delante. Todo libre.')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Disponibilidad' })).toBeNull();
  });

  it('cambiar de mes NO devuelve al esqueleto: se queda el mes anterior', async () => {
    servidor([{ date: dentroDe(3), note: null, groupId: 'g1' }]);
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await screen.findByRole('button', { name: `${dentroDe(3)} · ocupado` });
    await usuario.click(screen.getByRole('button', { name: 'Mes siguiente' }));

    // La rejilla sigue ahí en el mismo fotograma: `keepPreviousData`.
    expect(screen.getAllByRole('button', { name: /· (libre|ocupado)$/ }).length).toBeGreaterThan(20);
  });
});

describe('la nota de una reserva que ya existe', () => {
  /**
   * El agujero que esto cierra: con el rango entero ocupado, la única acción
   * era «Liberar». Corregir una coma de «Boda de Ana» obligaba a destruir la
   * reserva y rehacerla, perdiendo el rango y el grupo.
   */
  it('se puede editar sin liberar, y llega como PUT con busy true', async () => {
    const llamadas = servidor([
      { date: dentroDe(3), note: 'Boda de Ana', groupId: 'g1' },
      { date: dentroDe(4), note: 'Boda de Ana', groupId: 'g1' },
    ]);
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: `${dentroDe(3)} · ocupado` }));
    await usuario.click(dia(dentroDe(4), 'ocupado'));

    // La nota viene puesta con la que ya tenía: no hay que reescribirla.
    const campo = screen.getByLabelText('Nota privada');
    expect(campo).toHaveValue('Boda de Ana');
    await usuario.clear(campo);
    await usuario.type(campo, 'Boda de Ana · pagó adelanto');
    await usuario.click(screen.getByRole('button', { name: 'Guardar la nota' }));

    await waitFor(() => {
      const put = llamadas.find((l) => l.metodo === 'PUT');
      expect(put).toBeDefined();
      expect(put!.cuerpo).toEqual({
        dates: [dentroDe(3), dentroDe(4)],
        busy: true,
        note: 'Boda de Ana · pagó adelanto',
      });
    });
  });

  it('sobre días libres la acción sigue siendo marcar, no guardar', async () => {
    servidor();
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: `${dentroDe(3)} · libre` }));
    expect(screen.getByRole('button', { name: 'Marcar como ocupado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Liberar estos días' })).toBeNull();
  });
});

describe('deshacer', () => {
  /**
   * Liberar se lleva la reserva Y su nota de un toque. El proyecto no usa
   * `confirm()` y una hoja aquí sería demasiada ceremonia para algo frecuente,
   * así que la salida es deshacer — y tiene que devolver los MISMOS días con la
   * MISMA nota, no solo volver a ocuparlos.
   */
  it('devuelve los días y la nota que se acaban de borrar', async () => {
    const llamadas = servidor([{ date: dentroDe(3), note: 'Boda de Ana', groupId: 'g1' }]);
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: `${dentroDe(3)} · ocupado` }));
    await usuario.click(screen.getByRole('button', { name: 'Liberar estos días' }));

    // `findAll…[0]`: sonner pinta el toast dos veces, la visible y la del
    // anuncio para lectores de pantalla.
    await usuario.click((await screen.findAllByRole('button', { name: 'Deshacer' }))[0]!);

    await waitFor(() => {
      const puts = llamadas.filter((l) => l.metodo === 'PUT');
      expect(puts).toHaveLength(2);
      expect(puts[0]!.cuerpo).toMatchObject({ busy: false });
      expect(puts[1]!.cuerpo).toEqual({
        dates: [dentroDe(3)],
        busy: true,
        note: 'Boda de Ana',
      });
    });
  });

  it('marcar NO ofrece deshacer: se deshace liberando, que es lo que se ve', async () => {
    servidor();
    const usuario = userEvent.setup();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    await usuario.click(await screen.findByRole('button', { name: `${dentroDe(3)} · libre` }));
    await usuario.click(screen.getByRole('button', { name: 'Marcar como ocupado' }));

    await screen.findAllByText(/^Ocupado:/);
    expect(screen.queryAllByRole('button', { name: 'Deshacer' })).toHaveLength(0);
  });
});

describe('el pasado', () => {
  it('un día pasado y libre NO se puede tocar', async () => {
    servidor();
    render(<PantallaDisponibilidad />, { wrapper: Marco });
    // Ayer, si cae dentro de la rejilla del mes que se está viendo.
    const ayer = await screen.findByRole('button', { name: `${dentroDe(-1)} · libre` });
    expect(ayer).toBeDisabled();
  });

  /**
   * Y ocupado SÍ: equivocarse arrastrando un rango es justo lo que va a pasar,
   * y sin esto un día mal marcado en el pasado no se podría quitar nunca. La
   * API lo permite a propósito y la pantalla tiene que ir a juego.
   */
  it('un día pasado y OCUPADO sí, para poder deshacer un error', async () => {
    servidor([{ date: dentroDe(-1), note: null, groupId: 'g1' }]);
    render(<PantallaDisponibilidad />, { wrapper: Marco });
    expect(await screen.findByRole('button', { name: `${dentroDe(-1)} · ocupado` })).toBeEnabled();
  });
});

describe('lo que se mira, no lo que se toca', () => {
  it('enseña lo grabado y sin publicar CON su acción', async () => {
    servidor();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    expect(await screen.findByText('Grabado y sin publicar')).toBeInTheDocument();
    expect(screen.getByText(/XV de Rosa/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Crear su galería/ })).toHaveAttribute(
      'href',
      '/?nueva=true',
    );
  });

  /**
   * El dato accionable: no «alguien preguntó por un día cogido» sino «QUÉ día».
   */
  it('enseña las fechas más pedidas y marca las que están cogidas', async () => {
    servidor();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    const tarjeta = await screen.findByRole('region', { name: 'Las fechas más pedidas' });
    expect(within(tarjeta).getByText('3 veces · cogida')).toBeInTheDocument();
    expect(within(tarjeta).getByText('1 vez')).toBeInTheDocument();
    expect(
      within(tarjeta).getByText(/trabajo que estás rechazando/),
    ).toBeInTheDocument();
  });

  it('dice cuándo llega a la web: no es al momento', async () => {
    servidor();
    render(<PantallaDisponibilidad />, { wrapper: Marco });
    expect(await screen.findByText(/en la siguiente/)).toBeInTheDocument();
  });

  it('enseña lo que viene, los sábados y los clics separados', async () => {
    servidor();
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    expect(await screen.findByText('Boda de Ana')).toBeInTheDocument();
    expect(screen.getByText('2 de 4')).toBeInTheDocument();
    expect(screen.getByText('desde un día libre')).toBeInTheDocument();
    expect(screen.getByText('preguntando por uno ya cogido')).toBeInTheDocument();
  });

  it('sin nada por delante lo DICE, no deja el hueco', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((entrada: string | URL | Request) => {
        const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
        if (url.pathname === '/api/admin/availability/summary')
          return Promise.resolve(ok({ ...RESUMEN, proximas: [], sinGaleria: [] }));
        return Promise.resolve(ok([]));
      }),
    );
    render(<PantallaDisponibilidad />, { wrapper: Marco });

    expect(await screen.findByText('Nada cogido por delante. Todo libre.')).toBeInTheDocument();
    expect(screen.queryByText('Grabado y sin publicar')).toBeNull();
  });
});
