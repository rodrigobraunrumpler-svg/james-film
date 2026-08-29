import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmarBorrado } from './confirmar-borrado';

const montar = (props: Partial<Parameters<typeof ConfirmarBorrado>[0]> = {}) => {
  const onConfirmar = vi.fn();
  const onCancelar = vi.fn();
  render(
    <ConfirmarBorrado
      nombre="XV de Camila"
      descripcion="Se borrarán sus 30 reels."
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
      {...props}
    />,
  );
  return { onConfirmar, onCancelar };
};

describe('ConfirmarBorrado', () => {
  it('el botón nace deshabilitado: no se puede borrar sin leer', async () => {
    montar();
    expect(screen.getByRole('button', { name: 'Borrar para siempre' })).toBeDisabled();
  });

  it('se habilita solo cuando el nombre coincide EXACTAMENTE', async () => {
    const usuario = userEvent.setup();
    montar();
    const campo = screen.getByLabelText(/Escribe/);
    const boton = screen.getByRole('button', { name: 'Borrar para siempre' });

    await usuario.type(campo, 'XV de Cami');
    expect(boton).toBeDisabled();

    await usuario.type(campo, 'la');
    expect(boton).toBeEnabled();
  });

  it('dice QUÉ se va a perder, no un «¿seguro?»', () => {
    montar();
    expect(screen.getByText('Se borrarán sus 30 reels.')).toBeInTheDocument();
  });

  it('cancelar no borra nada', async () => {
    const usuario = userEvent.setup();
    const { onCancelar, onConfirmar } = montar();

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancelar).toHaveBeenCalled();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('es un alertdialog, para que un lector de pantalla lo anuncie', () => {
    montar();
    expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');
  });
});
