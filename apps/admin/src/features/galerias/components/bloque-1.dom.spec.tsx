import { QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/lib/query/cliente';
import { navegacion } from '../../../../vitest.setup.dom';
import type { FiltrosGalerias } from '../services/galerias';
import { EditorGaleria } from './editor-galeria';
import { ListaGalerias } from './lista-galerias';

let filtros: FiltrosGalerias = { estado: 'todas', q: '', page: 1, pageSize: 20 };
vi.mock('../hooks/use-filtros-galerias', () => ({
  useFiltrosGalerias: () => ({ filtros, setFiltros: vi.fn() }),
}));

const CATEGORIAS = [
  {
    id: 'c1',
    slug: 'bodas',
    name: 'Bodas',
    tagline: null,
    description: null,
    coverUrl: null,
    isActive: true,
    order: 0,
    metaTitle: null,
    metaDescription: null,
    galleryCount: 0,
    packageCount: 0,
  },
];

const medio = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'REEL',
  orientation: 'VERTICAL',
  url: `https://cdn/${id}.mp4`,
  posterUrl: null,
  width: 1080,
  height: 1920,
  durationSec: 30,
  alt: null,
  caption: null,
  order: 0,
  isFeatured: false,
  status: 'READY',
  error: null,
  ...over,
});

const galeria = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  slug: 'xv-de-camila',
  title: 'XV de Camila',
  description: null,
  eventDate: null,
  location: null,
  coverUrl: null,
  isFeatured: false,
  isPublished: false,
  hasConsent: false,
  category: { id: 'c1', slug: 'bodas', name: 'Bodas' },
  media: [],
  updatedAt: '2026-08-26T10:00:00.000Z',
  coverType: null,
  coverDurationSec: null,
  ...over,
});

const ok = (data: unknown, meta?: unknown) =>
  new Response(JSON.stringify({ success: true, code: 'OK', data, meta, timestamp: 'x' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const META = {
  totalCount: 0,
  pageCount: 0,
  currentPage: 1,
  pageSize: 20,
  isFirstPage: true,
  isLastPage: true,
  previousPage: null,
  nextPage: null,
};

function servidor(opciones: { lista?: unknown[]; detalle?: unknown } = {}) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(entrada instanceof Request ? entrada.url : entrada), 'http://x');
      const metodo = init?.method ?? 'GET';
      const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      llamadas.push({ metodo, ruta: url.pathname, cuerpo });

      if (url.pathname === '/api/admin/categories') return Promise.resolve(ok(CATEGORIAS));
      if (metodo === 'POST' && url.pathname === '/api/admin/galleries') {
        return Promise.resolve(ok(galeria({ id: 'nueva' })));
      }
      if (metodo === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      if (url.pathname === '/api/admin/galleries') {
        return Promise.resolve(ok(opciones.lista ?? [], META));
      }
      return Promise.resolve(ok(opciones.detalle ?? galeria()));
    }),
  );

  return {
    de: (metodo: string, fragmento: string) =>
      llamadas.filter((l) => l.metodo === metodo && l.ruta.includes(fragmento)),
  };
}

let cliente = crearQueryClient(() => {});
const Envoltorio = ({ children }: { children: ReactNode }) => (
  <NuqsAdapter>
    <QueryClientProvider client={cliente}>
      {children}
      <Toaster />
    </QueryClientProvider>
  </NuqsAdapter>
);

const ESPERA = { timeout: 5000 } as const;

beforeEach(() => {
  // `?nueva=true` sobrevive entre tests del mismo fichero: sin esto, el test que
  // abre el formulario deja al siguiente empezando con la hoja ya abierta.
  window.history.replaceState(null, '', '/');
  cliente = crearQueryClient(() => {});
  filtros = { estado: 'todas', q: '', page: 1, pageSize: 20 };
  vi.clearAllMocks();
});

describe('crear una galería', () => {
  it('el botón del estado vacío ABRE el formulario', async () => {
    // Antes se pintaba y no hacía nada: `EstadoVacio` recibía un `alCrear`
    // opcional que nadie le pasaba. Sin esto, James no puede ni empezar.
    const usuario = userEvent.setup();
    servidor();
    render(<ListaGalerias />, { wrapper: Envoltorio });

    await usuario.click(await screen.findByRole('button', { name: 'Crear la primera' }));

    expect(screen.getByLabelText('Nombre del evento')).toBeInTheDocument();
  });

  it('crea y lleva DIRECTO al editor', async () => {
    // Lo siguiente que hace James es subir los reels: devolverlo a la lista
    // sería un clic de más.
    const usuario = userEvent.setup();
    const api = servidor();
    render(<ListaGalerias />, { wrapper: Envoltorio });

    await usuario.click(await screen.findByRole('button', { name: 'Crear la primera' }));
    await usuario.type(screen.getByLabelText('Nombre del evento'), 'Boda de Ana');
    await usuario.click(screen.getByRole('button', { name: 'Crear y subir reels' }));

    await waitFor(() => expect(api.de('POST', '/admin/galleries')).toHaveLength(1), ESPERA);
    expect(api.de('POST', '/admin/galleries')[0].cuerpo).toEqual({
      title: 'Boda de Ana',
      categoryId: 'c1',
    });
    expect(navegacion.push).toHaveBeenCalledWith('/galerias/nueva');
  });

  it('no deja crear con el nombre vacío', async () => {
    const usuario = userEvent.setup();
    servidor();
    render(<ListaGalerias />, { wrapper: Envoltorio });

    await usuario.click(await screen.findByRole('button', { name: 'Crear la primera' }));

    expect(screen.getByRole('button', { name: 'Crear y subir reels' })).toBeDisabled();
  });
});

describe('borrar una galería', () => {
  it('exige escribir el nombre, y dice cuántos archivos se lleva', async () => {
    // §9: «que tenga que escribir el nombre, tipo GitHub». El confirm() nativo
    // en iOS sale como diálogo del SISTEMA y se acepta sin leerlo.
    const usuario = userEvent.setup();
    const api = servidor({ detalle: galeria({ media: [medio('m1'), medio('m2')] }) });
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    await usuario.click(await screen.findByRole('button', { name: 'Borrar galería' }));

    expect(screen.getByText(/Se borrarán también sus 2 archivos/)).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Borrar para siempre' });
    expect(boton).toBeDisabled();

    await usuario.type(screen.getByLabelText(/Escribe/), 'XV de Camila');
    await usuario.click(boton);

    await waitFor(() => expect(api.de('DELETE', '/admin/galleries/g1')).toHaveLength(1), ESPERA);
    expect(navegacion.push).toHaveBeenCalledWith('/');
  });
});

describe('«Ver en la web» y destacar', () => {
  it('el enlace SOLO aparece si está publicada', async () => {
    // Enlazar a una URL que devuelve 404 es peor que no ofrecer el enlace.
    servidor({ detalle: galeria({ isPublished: false }) });
    const { unmount } = render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });
    await screen.findByLabelText('Título');
    expect(screen.queryByRole('link', { name: /Ver en la web/ })).not.toBeInTheDocument();
    unmount();

    cliente = crearQueryClient(() => {});
    servidor({ detalle: galeria({ isPublished: true }) });
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    const enlace = await screen.findByRole('link', { name: /Ver en la web/ });
    expect(enlace).toHaveAttribute('href', expect.stringContaining('/galerias/xv-de-camila'));
    expect(enlace).toHaveAttribute('target', '_blank');
  });

  it('destacar la galería manda isFeatured', async () => {
    const usuario = userEvent.setup();
    const api = servidor();
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    await usuario.click(
      await screen.findByRole('button', { name: 'Ponerla la primera en la web' }),
    );

    await waitFor(() => expect(api.de('PATCH', '/admin/galleries/g1')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/admin/galleries/g1')[0].cuerpo).toEqual({ isFeatured: true });
  });
});

describe('el alt de un medio', () => {
  it('se puede escribir, y se manda al servidor', async () => {
    // Es accesibilidad de la landing: sin él un lector de pantalla anuncia
    // «imagen» y ya.
    const usuario = userEvent.setup();
    const api = servidor({ detalle: galeria({ media: [medio('m1')] }) });
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    await usuario.click(await screen.findByRole('button', { name: /Añadir descripción/ }));
    await usuario.type(
      screen.getByLabelText('Descripción para lectores de pantalla'),
      'Novios bailando',
    );
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.de('PATCH', '/admin/media/m1')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/admin/media/m1')[0].cuerpo).toEqual({
      alt: 'Novios bailando',
      caption: null,
    });
  });

  it('el botón dice si YA tiene descripción', async () => {
    servidor({ detalle: galeria({ media: [medio('m1', { alt: 'Ya tiene' })] }) });
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    expect(await screen.findByRole('button', { name: /Editar la descripción/ })).toHaveTextContent(
      'Descripción ✓',
    );
  });
});


/**
 * PUBLICAR PREGUNTA POR LA AUTORIZACIÓN, y solo la primera vez.
 *
 * En una galería salen caras de gente real y en los XV años salen MENORES. La
 * API lo rechaza con 422 `CONSENT_REQUIRED`, pero un 422 llega DESPUÉS de
 * pulsar y se lee como un fallo del sistema, no como una pregunta.
 *
 * En una `Hoja`, nunca con `confirm()`: en iOS el nativo se acepta con el
 * pulgar sin leerlo, que es justo el fallo del que esto protege.
 */
describe('la autorización de imagen', () => {
  it('sin permiso, publicar abre la hoja y NO manda nada todavía', async () => {
    const usuario = userEvent.setup();
    const api = servidor({ detalle: galeria({ isPublished: false, hasConsent: false }) });
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    await usuario.click(await screen.findByRole('button', { name: 'Publicar galería' }));

    expect(await screen.findByText(/autorización firmada/i)).toBeInTheDocument();
    expect(
      api.de('PATCH', '/admin/galleries/g1'),
      'se publicó sin preguntar',
    ).toHaveLength(0);
  });

  it('al confirmar manda el permiso y la publicación en UN solo patch', async () => {
    // Dos peticiones dejarían la galería con el permiso marcado y sin publicar
    // si fallara la segunda: mintiendo sobre lo que se acaba de confirmar.
    const usuario = userEvent.setup();
    const api = servidor({ detalle: galeria({ isPublished: false, hasConsent: false }) });
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    await usuario.click(await screen.findByRole('button', { name: 'Publicar galería' }));
    await usuario.click(await screen.findByRole('button', { name: /Sí, la tengo firmada/ }));

    await waitFor(() => expect(api.de('PATCH', '/admin/galleries/g1')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/admin/galleries/g1')[0]!.cuerpo).toEqual({
      isPublished: true,
      hasConsent: true,
    });
  });

  it('con el permiso YA marcado no vuelve a preguntar', async () => {
    const usuario = userEvent.setup();
    const api = servidor({ detalle: galeria({ isPublished: false, hasConsent: true }) });
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    await usuario.click(await screen.findByRole('button', { name: 'Publicar galería' }));

    await waitFor(() => expect(api.de('PATCH', '/admin/galleries/g1')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/admin/galleries/g1')[0]!.cuerpo).toEqual({ isPublished: true });
  });

  it('DESPUBLICAR nunca pregunta: retirar algo es como se atiende una cancelación', async () => {
    const usuario = userEvent.setup();
    const api = servidor({ detalle: galeria({ isPublished: true, hasConsent: true }) });
    render(<EditorGaleria id="g1" />, { wrapper: Envoltorio });

    await usuario.click(await screen.findByRole('button', { name: 'Pasar a borrador' }));

    await waitFor(() => expect(api.de('PATCH', '/admin/galleries/g1')).toHaveLength(1), ESPERA);
    expect(api.de('PATCH', '/admin/galleries/g1')[0]!.cuerpo).toEqual({ isPublished: false });
  });
});
