import { ListaCategorias } from '@/features/categorias/components/lista-categorias';

export const metadata = { title: 'Categorías · James Film' };

/** Ruta fina: importa la feature y ya. Sin lógica, sin fetch. */
export default function Page() {
  // El h1 vive dentro de la lista: comparte fila con «Nueva categoría», y
  // separarlos los dejaría en dos líneas distintas.
  return <ListaCategorias />;
}
