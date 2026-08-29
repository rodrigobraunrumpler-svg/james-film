'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Boton } from '@/components/shared/boton';
import { esApiError } from '@/lib/api/errors';
import { useCategoriasComoOpciones } from '@/lib/catalogo/categorias';
import { useCrearGaleria } from '../hooks/use-crear-galeria';

/**
 * Lo mínimo para empezar: título y categoría. El resto —fecha, lugar,
 * descripción— se rellena luego en el editor, porque el día de la boda James
 * solo quiere subir los reels.
 */
export function NuevaGaleria({ onCerrar }: { onCerrar: () => void }) {
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

  if (isPending) return <p className="text-ash text-sm">Cargando categorías…</p>;

  if (activas.length === 0) {
    // Sin categorías no hay galería posible: se dice qué hacer, no «error».
    return (
      <div role="alert" className="border-line-strong bg-card rounded-card border p-4">
        Antes de crear una galería necesitas al menos una categoría activa. Créala en{' '}
        <a href="/categorias" className="text-brass underline">
          Categorías
        </a>
        .
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
      noValidate
      className="border-line-strong bg-card rounded-card flex flex-col gap-4 border p-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nueva-title" className="text-muted text-xs">
          Nombre del evento
        </label>
        <input
          id="nueva-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="XV de Camila"
          autoFocus
          className="campo bg-well border-line"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nueva-categoria" className="text-muted text-xs">
          Categoría
        </label>
        <select
          id="nueva-categoria"
          value={elegida}
          onChange={(e) => setCategoryId(e.target.value)}
          className="campo bg-well border-line"
        >
          {activas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
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
  );
}
