import { ListaCategorias } from '@/features/categorias/components/lista-categorias';

export const metadata = { title: 'Categorías · James Film' };

/** Ruta fina: importa la feature y ya. Sin lógica, sin fetch. */
export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Categorías</h1>
      <ListaCategorias />
    </div>
  );
}
