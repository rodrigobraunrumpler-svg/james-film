import { Suspense } from 'react';
import { ListaGalerias } from '@/features/galerias/components/lista-galerias';
import { SkeletonLista } from '@/features/galerias/components/skeleton-lista';

export const metadata = { title: 'Galerías · James Film' };

/** Ruta fina: importa la feature y ya. Sin lógica, sin fetch, sin JSX largo. */
export default function Page() {
  // La cabecera y las pestañas viven dentro de ListaGalerias: dependen del
  // filtro, y el filtro está en la URL que lee nuqs.
  return (
    <Suspense fallback={<SkeletonLista />}>
      <ListaGalerias />
    </Suspense>
  );
}
