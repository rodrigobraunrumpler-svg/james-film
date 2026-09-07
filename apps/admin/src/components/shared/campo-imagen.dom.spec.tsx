import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampoImagen } from './campo-imagen';

describe('CampoImagen', () => {
  it('«Quitar» ESCONDE la miniatura, aunque el padre siga mandando la URL', async () => {
    // El fallo: «Quitar» avisaba con `null` pero la miniatura seguía ahí,
    // porque el componente volvía a caer en el `valorUrl` del padre — que no
    // cambia hasta guardar y refetchear. Cada pantalla lo apañaba por su
    // cuenta y SEIS DE NUEVE se olvidaron.
    const alCambiar = vi.fn();
    // La miniatura es `alt=""` —decorativa, el texto lo da la etiqueta— así que
    // NO tiene rol `img`: se busca por el nodo.
    const { container } = render(
      <CampoImagen
        etiqueta="Foto de la persona"
        proposito="AVATAR_TESTIMONIO"
        valorUrl="https://cdn.test/foto.jpg"
        onChange={alCambiar}
      />,
    );

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/foto.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Sin imagen')).toBeInTheDocument();
    // `null` BORRA la clave; omitirla la dejaría en la base.
    expect(alCambiar).toHaveBeenCalledWith(null);
  });

  it('tras quitar, el botón vuelve a decir «Elegir archivo»', async () => {
    render(
      <CampoImagen
        etiqueta="Logo"
        proposito="LOGO"
        valorUrl="https://cdn.test/logo.svg"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(screen.getByRole('button', { name: 'Elegir archivo' })).toBeInTheDocument();
    // Y «Quitar» desaparece: no hay nada que quitar.
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
  });

  it('sin imagen no se ofrece quitar, y dice qué falta', () => {
    render(<CampoImagen etiqueta="Logo" proposito="LOGO" valorUrl={null} onChange={vi.fn()} />);

    // Un rectángulo negro sin nada no distingue «no hay» de «no ha cargado».
    expect(screen.getByText('Sin imagen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
  });
});
