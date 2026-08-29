'use client';

import { useState } from 'react';
import { Boton } from './boton';

/**
 * §9: «que tenga que escribir el nombre, tipo GitHub».
 *
 * El `confirm()` del navegador no vale para lo que no tiene vuelta atrás: en
 * iOS sale como un diálogo del SISTEMA —no de la app— y se acepta con el
 * pulgar sin leerlo. Escribir el nombre obliga a mirar QUÉ se está borrando.
 *
 * Se usa solo donde el borrado es irreversible o se lleva archivos por delante.
 * Para lo demás basta con un botón y un toast: pedir confirmación de todo
 * entrena a confirmar sin leer, que es justo lo que esto evita.
 */
export function ConfirmarBorrado({
  nombre,
  descripcion,
  onConfirmar,
  onCancelar,
  cargando,
}: {
  nombre: string;
  descripcion: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  cargando?: boolean;
}) {
  const [escrito, setEscrito] = useState('');
  const coincide = escrito.trim() === nombre.trim();

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirmar-titulo"
      className="flex flex-col gap-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex flex-col gap-1">
        <p id="confirmar-titulo" className="text-danger font-medium">
          Vas a borrar «{nombre}»
        </p>
        <p className="text-ash text-sm">{descripcion}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmar-nombre" className="text-ash text-sm">
          Escribe <strong>{nombre}</strong> para confirmar
        </label>
        <input
          id="confirmar-nombre"
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
          autoComplete="off"
          className="campo border-danger-line"
        />
      </div>

      <div className="flex gap-2">
        <Boton className="flex-1" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton
          variante="peligro"
          className="flex-1"
          disabled={!coincide || cargando}
          onClick={onConfirmar}
        >
          {cargando ? 'Borrando…' : 'Borrar para siempre'}
        </Boton>
      </div>
    </div>
  );
}
