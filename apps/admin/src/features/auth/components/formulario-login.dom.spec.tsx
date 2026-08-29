import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navegacion } from '../../../../vitest.setup.dom';
import { FormularioLogin } from './formulario-login';

// La URL cambia por test: el motivo de la sesión y el `desde` viajan ahí.
let parametros = new URLSearchParams();
vi.mock('next/navigation', async (importar) => {
  const real = await importar<Record<string, unknown>>();
  const { navegacion } = await import('../../../../vitest.setup.dom');
  return {
    ...real,
    useRouter: () => navegacion,
    usePathname: () => '/login',
    useSearchParams: () => parametros,
  };
});

const respuesta = (
  status: number,
  cuerpo: Record<string, unknown>,
  cabeceras: Record<string, string> = {},
) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json', ...cabeceras },
  });

const rellenarYEnviar = async (usuario: ReturnType<typeof userEvent.setup>) => {
  await usuario.type(screen.getByLabelText('Email'), 'james@jamesfilm.pe');
  await usuario.type(screen.getByLabelText('Contraseña'), 'una-clave-larga');
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
};

beforeEach(() => {
  parametros = new URLSearchParams();
  vi.clearAllMocks();
});

describe('formulario de login', () => {
  it('el mensaje se elige por CODE, no por la cadena que mande el servidor', async () => {
    const usuario = userEvent.setup();
    // El servidor manda un `message` distinto a propósito: si el admin lo
    // pintara tal cual, cambiar el copy de la API cambiaría el del admin.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(respuesta(401, { code: 'INVALID_CREDENTIALS', message: 'Unauthorized' })),
      ),
    );

    render(<FormularioLogin />);
    await rellenarYEnviar(usuario);

    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
  });

  it('al fallar, el foco vuelve a la contraseña con el texto marcado', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(respuesta(401, { code: 'INVALID_CREDENTIALS' }))),
    );

    render(<FormularioLogin />);
    await rellenarYEnviar(usuario);

    // Sin esto hay que buscar el campo, borrar y reescribir: tres gestos de más
    // justo cuando ya has fallado una vez.
    const clave = screen.getByLabelText('Contraseña') as HTMLInputElement;
    await waitFor(() => expect(clave).toHaveFocus());
    expect(clave.selectionStart).toBe(0);
    expect(clave.selectionEnd).toBe(clave.value.length);
  });

  it('con límite de intentos cuenta los segundos y bloquea el botón', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(respuesta(429, { code: 'RATE_LIMITED' }, { 'retry-after': '45' })),
      ),
    );

    render(<FormularioLogin />);
    await rellenarYEnviar(usuario);

    // Dejar pulsar solo consigue que el throttler reinicie la ventana.
    const boton = await screen.findByRole('button', { name: /Espera 45 s/ });
    expect(boton).toBeDisabled();
    expect(screen.getByText(/Puedes volver a probar en 45 s/)).toBeInTheDocument();
  });

  it('sin cabecera Retry-After no se inventa ninguna cuenta atrás', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(respuesta(429, { code: 'RATE_LIMITED' }))),
    );

    render(<FormularioLogin />);
    await rellenarYEnviar(usuario);

    expect(
      await screen.findByText('Demasiados intentos. Espera un minuto y vuelve a probar.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('dice POR QUÉ está aquí cuando le echó la sesión, y no como un error suyo', async () => {
    parametros = new URLSearchParams('motivo=revocada');
    render(<FormularioLogin />);

    const aviso = await screen.findByText('Cerramos tu sesión por seguridad. Vuelve a entrar.');
    // En tono neutro: no es un fallo de James, y en rojo le haría buscar qué
    // hizo mal. `danger` es para lo que sí es culpa de lo que escribió.
    expect(aviso.className).not.toContain('danger');
  });

  it('distingue caducada de revocada: son cosas distintas', async () => {
    parametros = new URLSearchParams('motivo=caducada');
    render(<FormularioLogin />);
    expect(await screen.findByText('Tu sesión caducó. Vuelve a entrar.')).toBeInTheDocument();
  });

  it('el ojo enseña y esconde la contraseña', async () => {
    const usuario = userEvent.setup();
    render(<FormularioLogin />);

    const clave = screen.getByLabelText('Contraseña');
    expect(clave).toHaveAttribute('type', 'password');

    await usuario.click(screen.getByRole('button', { name: 'Mostrar la contraseña' }));
    expect(clave).toHaveAttribute('type', 'text');

    await usuario.click(screen.getByRole('button', { name: 'Ocultar la contraseña' }));
    expect(clave).toHaveAttribute('type', 'password');
  });

  it('avisa de Bloq Mayús, que si no el fallo no tiene explicación', async () => {
    const usuario = userEvent.setup();
    render(<FormularioLogin />);

    await usuario.click(screen.getByLabelText('Contraseña'));
    expect(screen.queryByText('Tienes Bloq Mayús activado.')).not.toBeInTheDocument();

    await usuario.keyboard('{CapsLock}a');
    expect(screen.getByText('Tienes Bloq Mayús activado.')).toBeInTheDocument();

    await usuario.keyboard('{CapsLock}b');
    expect(screen.queryByText('Tienes Bloq Mayús activado.')).not.toBeInTheDocument();
  });

  it('precarga el destino mientras James escribe', async () => {
    parametros = new URLSearchParams('desde=%2Fgalerias%2Fg1');
    render(<FormularioLogin />);

    // Lo más lento del flujo es el primer render DESPUÉS de acertar la clave.
    await waitFor(() => expect(navegacion.prefetch).toHaveBeenCalledWith('/galerias/g1'));
  });
});
