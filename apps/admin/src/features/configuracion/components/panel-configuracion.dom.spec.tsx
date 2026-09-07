import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsAdapter } from 'nuqs/adapters/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from 'sonner';
import { crearQueryClient } from '@/lib/query/cliente';
import { PanelConfiguracion } from './panel-configuracion';

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const AJUSTES = {
  brandName: 'James Film',
  role: 'Creador de contenido',
  tagline: 'Tu evento, en 60 segundos.',
  slogan: 'Reels y aftermovies en Ayacucho.',
  aboutText: null,
  logoUrl: null,
  signatureUrl: null,
  whatsappNumber: '51994724944',
  whatsappDisplay: '994 724 944',
  whatsappMessage: 'Hola James',
  ctaText: 'Escríbeme por WhatsApp',
  email: null,
  heroMediaUrl: null,
  heroPosterUrl: null,
  footerTagline: null,
  metaTitle: null,
  metaDescription: null,
  ogImageUrl: null,
};

function servidor(sobreescribe: Partial<Record<keyof typeof AJUSTES, unknown>> = {}) {
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
      if (url.pathname === '/api/admin/settings')
        return Promise.resolve(ok({ ...AJUSTES, ...sobreescribe }));
      return Promise.resolve(ok([]));
    }),
  );
  return llamadas;
}

let cliente = crearQueryClient(() => {});
/**
 * El panel monta cinco pestañas de campos y una vista previa: el segundo que
 * `findBy*` da por defecto se queda corto en happy-dom cuando la máquina está
 * cargada.
 */
const ESPERA = { timeout: 5000 } as const;

/**
 * Se ABRE la pestaña, no se da por hecha. nuqs guarda el estado en un emisor
 * del módulo y **no escucha `replaceState`**, así que resetear la URL en el
 * `beforeEach` no basta: el test que acababa en SEO dejaba al siguiente
 * empezando ahí, y la aserción fallaba por la pestaña, no por el producto.
 */
async function abrirPestana(nombre: string) {
  const pestana = await screen.findByRole('tab', { name: nombre }, ESPERA);
  if (pestana.getAttribute('aria-selected') !== 'true') await userEvent.click(pestana);
  return pestana;
}

const Envoltorio = ({ children }: { children: ReactNode }) => (
  <NuqsAdapter>
    <QueryClientProvider client={cliente}>
      {children}
      <Toaster />
    </QueryClientProvider>
  </NuqsAdapter>
);

beforeEach(() => {
  vi.restoreAllMocks();
  cliente = crearQueryClient(() => {});
  // La pestaña se fija EXPLÍCITAMENTE, no por el valor por defecto: nuqs la
  // guarda en la URL y la URL sobrevive entre tests del mismo fichero, así que
  // el test que acaba en Contacto dejaba al siguiente empezando ahí.
  window.history.replaceState(null, '', '/configuracion?pestana=identidad');
});

describe('Configuración', () => {
  it('la vista previa enseña el titular y el CTA reales', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    const previa = await screen.findByLabelText('Vista previa de la web');
    expect(within(previa).getByText('Tu evento, en 60 segundos.')).toBeInTheDocument();
    expect(within(previa).getByText('Escríbeme por WhatsApp')).toBeInTheDocument();
  });

  it('escribir el titular lo cambia en la previa SIN guardar', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('Identidad');
    const campo = await screen.findByLabelText('Frase corta', {}, ESPERA);
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Bodas en Ayacucho');

    const previa = screen.getByLabelText('Vista previa de la web');
    await waitFor(() => {
      expect(within(previa).getByText('Bodas en Ayacucho')).toBeInTheDocument();
    });
  });

  it('Guardar arranca DESHABILITADO: un PATCH que no cambia nada marcaría la web como pendiente', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    expect(await screen.findByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('con un cambio se habilita y aparece Descartar', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('Identidad');
    await userEvent.type(await screen.findByLabelText('Frase corta', {}, ESPERA), '!');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('cambiar de pestaña con cambios pregunta en una Hoja, NUNCA con confirm()', async () => {
    servidor();
    const nativo = vi.fn(() => true);
    vi.stubGlobal('confirm', nativo);
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('Identidad');
    await userEvent.type(await screen.findByLabelText('Frase corta', {}, ESPERA), '!');
    await userEvent.click(screen.getByRole('tab', { name: 'SEO' }));

    // En iOS el `confirm()` nativo sale como un diálogo del SISTEMA y se acepta
    // con el pulgar sin leerlo.
    expect(nativo).not.toHaveBeenCalled();
    expect(await screen.findByText('¿Descartar los cambios?')).toBeInTheDocument();
  });

  it('«Seguir aquí» deja la pestaña donde estaba', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('Identidad');
    await userEvent.type(await screen.findByLabelText('Frase corta', {}, ESPERA), '!');
    await userEvent.click(screen.getByRole('tab', { name: 'SEO' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir aquí' }));

    // Se comprueba la URL y no el `aria-selected`: la hoja es modal y mientras
    // se cierra esconde el resto del árbol de accesibilidad, así que la
    // aserción dependería de la animación de salida en vez de del estado.
    // La pestaña VIVE en la URL —es la clave de nuqs—, así que es el dato real.
    expect(new URLSearchParams(window.location.search).get('pestana')).not.toBe('seo');
  });

  it('sin cambios se cambia de pestaña sin preguntar nada', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('Identidad');
    await userEvent.click(screen.getByRole('tab', { name: 'SEO' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'SEO' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.queryByText('¿Descartar los cambios?')).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('pestana')).toBe('seo');
  });

  it('el WhatsApp vive en su propia tarjeta con el enlace de prueba', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole('tab', { name: 'Contacto y redes' }));

    // Con mensaje configurado, el botón lo dice y el enlace lo lleva.
    const enlace = await screen.findByRole('link', { name: /Probar con el mensaje/ });
    // La única verificación que existe de verdad: James, con su teléfono. Y
    // tiene que abrir lo MISMO que abrirá la web, mensaje incluido: probar un
    // enlace distinto del que se publica es no probar nada.
    expect(enlace).toHaveAttribute('href', 'https://wa.me/51994724944?text=Hola%20James');
  });

  it('sin mensaje, el enlace es solo el número y el botón lo dice', async () => {
    servidor({ whatsappMessage: null });
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('Contacto y redes');

    const enlace = await screen.findByRole('link', { name: /Probar este número/ }, ESPERA);
    expect(enlace).toHaveAttribute('href', 'https://wa.me/51994724944');
  });

  it('SEO enseña SU previa: el resultado de Google y la tarjeta de WhatsApp', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('SEO');
    await screen.findByLabelText('Título en Google', {}, ESPERA);
    // La del hero NO: nada de lo que se toca en SEO sale ahí.
    expect(screen.queryByLabelText('Vista previa de la web')).not.toBeInTheDocument();
    const previa = screen.getByLabelText('Vista previa del SEO');
    expect(within(previa).getByText('En Google')).toBeInTheDocument();
    expect(within(previa).getByText('Al pegarlo en WhatsApp')).toBeInTheDocument();
  });

  it('el título de Google se ve en la previa mientras se escribe', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('SEO');
    await userEvent.type(
      await screen.findByLabelText('Título en Google', {}, ESPERA),
      'Reels en Ayacucho',
    );

    const previa = screen.getByLabelText('Vista previa del SEO');
    await waitFor(() => {
      // Sale DOS veces: en el resultado de Google y en la tarjeta de WhatsApp.
      expect(within(previa).getAllByText('Reels en Ayacucho')).toHaveLength(2);
    });
  });

  it('avisa cuando el título se pasa de lo que Google enseña', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('SEO');
    const campo = await screen.findByLabelText('Título en Google', {}, ESPERA);
    await userEvent.type(campo, 'x'.repeat(70));

    // No bloquea —Google corta por ancho, no por caracteres— pero lo dice.
    expect(await screen.findByText(/Google corta sobre los 60/)).toBeInTheDocument();
  });

  it('cada campo lleva su ayuda diciendo DÓNDE sale', async () => {
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('Identidad');
    await screen.findByLabelText('Frase corta', {}, ESPERA);
    // «Frase corta» y «Eslogan» son dos cajas indistinguibles sin esto.
    expect(screen.getByText(/El titular grande del hero/)).toBeInTheDocument();
    expect(screen.getByText(/La línea pequeña bajo el titular/)).toBeInTheDocument();
  });

  it('el contador de SEO cuenta lo que hay escrito y avisa al pasarse', async () => {
    // Google recorta por ANCHO, no por caracteres: el número es una guía, no un
    // límite, así que AVISA y no bloquea. Sin él, un título de 120 sale a
    // medias en el buscador y nada lo ha dicho.
    servidor();
    render(<PanelConfiguracion />, { wrapper: Envoltorio });

    await abrirPestana('SEO');
    const titulo = await screen.findByLabelText('Título en Google', {}, ESPERA);
    await userEvent.clear(titulo);
    await userEvent.type(titulo, 'Doce chars.');

    expect(await screen.findByText('11 / ~60')).toBeInTheDocument();
    // Y no ha deshabilitado nada: pasarse es legal.
    expect(titulo).not.toBeDisabled();
  });
});
