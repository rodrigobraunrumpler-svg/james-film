'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Boton } from '@/components/shared/boton';
import { Hoja } from '@/components/shared/hoja';
import { Selector } from '@/components/shared/selector';
import { esApiError } from '@/lib/api/errors';
import { useCategoriasComoOpciones } from '@/lib/catalogo/categorias';
import { useCrearGaleria } from '../hooks/use-crear-galeria';

/**
 * Lo mínimo para empezar: título y categoría. El resto —fecha, lugar,
 * descripción— se rellena luego en el editor, porque el día de la boda James
 * solo quiere subir los reels.
 *
 * En hoja, no en línea: intercalado en la lista empujaba las tarjetas hacia
 * abajo y en el móvil aparecía fuera de la pantalla. Es además lo que ya hace
 * el resto del admin con cualquier formulario.
 */
export function NuevaGaleria({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const { data: categorias, isPending } = useCategoriasComoOpciones();
  const crear = useCrearGaleria();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const activas = (categorias ?? []).filter((c) => c.isActive);
  const elegida = categoryId || activas[0]?.id || '';
  const puedeCrear = title.trim().length >= 2 && elegida !== '';

  // Sin anotar el evento: `React.FormEvent` está deprecado en los tipos de
  // React 19 y el tipo se infiere solo desde el `onSubmit` del formulario.
  const enviar = async (): Promise<void> => {
    if (!puedeCrear) return;
    try {
      // Al terminar, `useCrearGaleria` navega al editor.
      await crear.mutateAsync({ title: title.trim(), categoryId: elegida });
    } catch (err) {
      toast.error(esApiError(err) ? err.message : 'No se pudo crear la galería.');
    }
  };

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo="Nueva galería"
      descripcion="Una galería es un evento: los reels de una boda, unos XV, un cumpleaños."
    >
      {isPending ? (
        <p className="text-ash pb-[calc(1rem+env(safe-area-inset-bottom))]">Cargando categorías…</p>
      ) : activas.length === 0 ? (
        // Sin categorías no hay galería posible: se dice qué hacer, no «error».
        <p role="alert" className="text-ash pb-[calc(1rem+env(safe-area-inset-bottom))]">
          Antes de crear una galería necesitas al menos una categoría activa. Créala en{' '}
          <a href="/categorias" className="text-brass underline">
            Categorías
          </a>
          .
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
          noValidate
          className="flex flex-col gap-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex flex-col gap-1.25">
            <label htmlFor="nueva-title" className="text-muted text-xs">
              Nombre del evento
            </label>
            <input
              id="nueva-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="XV de Camila"
              autoFocus
              className="campo border-line"
            />
            <p className="text-muted text-xs">
              El que uses para reconocerlo. Se puede cambiar luego; el enlace no.
            </p>
          </div>

          <div className="flex flex-col gap-1.25">
            <label htmlFor="nueva-categoria" className="text-muted text-xs">
              Categoría
            </label>
            <Selector
              id="nueva-categoria"
              nombre="Categoría"
              valor={elegida}
              onCambiar={setCategoryId}
              opciones={activas.map((c) => ({ valor: c.id, etiqueta: c.name }))}
            />
          </div>

          <div className="bg-chrome border-line sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Boton className="flex-1" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton
              variante="principal"
              type="submit"
              className="flex-1"
              disabled={!puedeCrear || crear.isPending}
            >
              {crear.isPending ? 'Creando…' : 'Crear y subir reels'}
            </Boton>
          </div>
        </form>
      )}
    </Hoja>
  );
}
