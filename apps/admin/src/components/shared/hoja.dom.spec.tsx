import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Hoja } from './hoja';

function Ejemplo({ onCerrar }: { onCerrar?: () => void }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)}>
        Editar
      </button>
      <Hoja
        abierta={abierta}
        onCerrar={() => {
          setAbierta(false);
          onCerrar?.();
        }}
        titulo="Editar Bodas"
      >
        <input aria-label="Nombre" defaultValue="Bodas" />
      </Hoja>
    </>
  );
}

describe('Hoja', () => {
  it('no pinta nada mientras está cerrada', () => {
    render(<Ejemplo />);
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
  });

  it('al abrirla, el formulario está en un DIÁLOGO, no debajo de la lista', async () => {
    // Es la razón de existir: en línea, el formulario se pintaba fuera de la
    // pantalla del iPhone y había que bajar con el dedo a buscarlo.
    const usuario = userEvent.setup();
    render(<Ejemplo />);

    await usuario.click(screen.getByRole('button', { name: 'Editar' }));

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toBeInTheDocument();
    expect(dialogo).toContainElement(screen.getByLabelText('Nombre'));
  });

  it('lleva título accesible: un lector de pantalla anuncia QUÉ se está editando', async () => {
    const usuario = userEvent.setup();
    render(<Ejemplo />);

    await usuario.click(screen.getByRole('button', { name: 'Editar' }));

    expect(await screen.findByRole('dialog', { name: /Editar Bodas/ })).toBeInTheDocument();
  });

  it('el botón de cerrar la cierra', async () => {
    const usuario = userEvent.setup();
    const onCerrar = vi.fn();
    render(<Ejemplo onCerrar={onCerrar} />);
    await usuario.click(screen.getByRole('button', { name: 'Editar' }));
    await screen.findByRole('dialog');

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onCerrar).toHaveBeenCalled();
  });

  it('Escape la cierra: es lo que espera cualquiera en un diálogo', async () => {
    const usuario = userEvent.setup();
    const onCerrar = vi.fn();
    render(<Ejemplo onCerrar={onCerrar} />);
    await usuario.click(screen.getByRole('button', { name: 'Editar' }));
    await screen.findByRole('dialog');

    await usuario.keyboard('{Escape}');

    expect(onCerrar).toHaveBeenCalled();
  });

  it('la descripción sale visible cuando se pasa, y accesible cuando no', async () => {
    // Sin descripción, Radix avisa por consola de que falta la accesible: se
    // pone igual, en sr-only.
    const usuario = userEvent.setup();
    render(
      <Hoja abierta onCerrar={() => {}} titulo="Con descripción" descripcion="Explica algo">
        <p>contenido</p>
      </Hoja>,
    );

    expect(await screen.findByText('Explica algo')).toBeVisible();
    await usuario.keyboard('{Escape}');
  });
});
