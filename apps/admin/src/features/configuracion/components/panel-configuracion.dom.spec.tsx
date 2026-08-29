import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { PanelConfiguracion } from './panel-configuracion';

import type * as ModuloPestana from '../hooks/use-pestana';

// nuqs fuera de Next: el estado de la URL se sustituye por uno en memoria.
let pestanaActual = 'contacto';
const setPestanaMock = vi.fn((p: string) => {
  pestanaActual = p;
  return Promise.resolve(new URLSearchParams());
});
vi.mock('../hooks/use-pestana', async (importar) => {
  const real = await importar<typeof ModuloPestana>();
  return { ...real, usePestana: () => ({ pestana: pestanaActual, setPestana: setPestanaMock }) };
});

const AJUSTES = {
  brandName: 'James Film',
  role: 'Creador de contenido',
  tagline: null,
  slogan: null,
  aboutText: 'Soy **James**',
  logoUrl: null,
  signatureUrl: null,
  whatsappNumber: '51994724944',
  whatsappDisplay: '994 724 944',
  whatsappMessage: null,
  ctaText: null,
  email: null,
  heroMediaUrl: null,
  heroPosterUrl: null,
  footerTagline: null,
  metaTitle: null,
  metaDescription: null,
  ogImageUrl: null,
};

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function servidor(ajustes: Record<string, unknown> = AJUSTES) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  let actuales = ajustes;

  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
      const metodo = init?.method ?? 'GET';
      const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      llamadas.push({ metodo, ruta: url.pathname, cuerpo });

      if (url.pathname.includes('social-links') || url.pathname.includes('differentiators')) {
        return Promise.resolve(ok([]));
      }
      if (url.pathname === '/api/admin/icons') return Promise.resolve(ok(['zap']));
      if (metodo === 'PATCH') {
        actuales = { ...actuales, ...(cuerpo as object) };
        return Promise.resolve(ok(actuales));
      }
      return Promise.resolve(ok(actuales));
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
  pestanaActual = 'contacto';
  vi.clearAllMocks();
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

/** 🔴 El campo más importante del producto: el clic a WhatsApp ES el lead. */
describe('el número de WhatsApp', () => {
  it('ofrece un enlace para PROBARLO, que es la única verificación real', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    const enlace = await screen.findByRole('link', { name: 'Probar este número' });
    expect(enlace).toHaveAttribute('href', 'https://wa.me/51994724944');
  });

  it('rechaza un número sin prefijo de país', async () => {
    // Sin prefijo el botón de la landing no funciona y NO FALLA NADA:
    // simplemente nadie escribe nunca.
    const usuario = userEvent.setup();
    const api = servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    const campo = await screen.findByLabelText('Número de WhatsApp');
    await usuario.clear(campo);
    await usuario.type(campo, '994724944');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/Ejemplo: 51994724944/)).toBeInTheDocument();
    expect(api.de('PATCH', '/admin/settings')).toHaveLength(0);
  });

  it('avisa si el número que se marca y el que se muestra NO coinciden', async () => {
    // La web enseñaría uno y llamaría a otro, que para un cliente es peor que
    // no tener número.
    const usuario = userEvent.setup();
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    const display = await screen.findByLabelText('Cómo se muestra');
    await usuario.clear(display);
    await usuario.type(display, '111 222 333');

    expect(await screen.findByText(/enseñaría uno y llamaría a otro/)).toBeInTheDocument();
  });

  it('si coinciden, no avisa de nada', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await screen.findByLabelText('Número de WhatsApp');
    expect(screen.queryByText(/enseñaría uno y llamaría a otro/)).not.toBeInTheDocument();
  });

  it('propone el display al escribir el número, sin imponerlo', async () => {
    const usuario = userEvent.setup();
    servidor({ ...AJUSTES, whatsappNumber: '', whatsappDisplay: '' });
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    const campo = await screen.findByLabelText('Número de WhatsApp');
    await usuario.type(campo, '51994724944');

    await waitFor(() =>
      expect(screen.getByLabelText('Cómo se muestra')).toHaveValue('994 724 944'),
    );
  });
});

describe('las pestañas', () => {
  it('cambiar de pestaña con cambios sin guardar PREGUNTA antes', async () => {
    // Aquí no hay autoguardado: cada campo está en vivo en la web, y guardar a
    // los dos segundos de escribir medio número es publicar un número roto.
    const usuario = userEvent.setup();
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    const campo = await screen.findByLabelText('Texto del botón');
    await usuario.type(campo, 'Escríbeme');
    await usuario.click(screen.getByRole('tab', { name: 'SEO' }));

    expect(globalThis.confirm).toHaveBeenCalledWith(expect.stringContaining('sin guardar'));
  });

  it('sin cambios, cambiar de pestaña no pregunta nada', async () => {
    const usuario = userEvent.setup();
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await screen.findByLabelText('Número de WhatsApp');
    await usuario.click(screen.getByRole('tab', { name: 'SEO' }));

    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(setPestanaMock).toHaveBeenCalledWith('seo');
  });

  it('cada pestaña manda SOLO sus campos', async () => {
    // Con un formulario único, guardar SEO mandaría también el número de
    // WhatsApp y pisaría un cambio hecho en otra pestaña o desde el móvil.
    const usuario = userEvent.setup();
    pestanaActual = 'seo';
    const api = servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    const campo = await screen.findByLabelText('Título en Google');
    await usuario.type(campo, 'James Film');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.de('PATCH', '/admin/settings')).toHaveLength(1), ESPERA);
    const cuerpo = api.de('PATCH', '/admin/settings')[0].cuerpo as Record<string, unknown>;
    expect(Object.keys(cuerpo).sort()).toEqual(['metaDescription', 'metaTitle']);
    expect(cuerpo).not.toHaveProperty('whatsappNumber');
  });
});

describe('el texto «Sobre ti»', () => {
  it('enseña la vista previa con el resaltado', async () => {
    pestanaActual = 'identidad';
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    // El texto guardado es «Soy **James**»: la vista previa lo pinta en negrita.
    expect(await screen.findByText('James')).toHaveProperty('tagName', 'STRONG');
  });
});

describe('la sugerencia del display', () => {
  it('deja de proponerla en cuanto James escribe la suya', async () => {
    // El fallo que esto cubre: con un guard de «solo si está vacío», tras la
    // primera tecla el display ya no estaba vacío y se congelaba en «5».
    const usuario = userEvent.setup();
    servidor({ ...AJUSTES, whatsappNumber: '', whatsappDisplay: '' });
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    const display = await screen.findByLabelText('Cómo se muestra');
    await usuario.type(display, 'Mi número');

    await usuario.type(screen.getByLabelText('Número de WhatsApp'), '51994724944');

    expect(display).toHaveValue('Mi número');
  });
});
