import { Suspense } from 'react';
import { ListaGalerias } from '@/features/galerias/components/lista-galerias';
import { SkeletonLista } from '@/features/galerias/components/skeleton-lista';

export const metadata = { title: 'Galerías · James Film' };

/** Ruta fina: importa la feature y ya. Sin lógica, sin fetch, sin JSX largo. */
export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Galerías</h1>
      {/* nuqs lee la URL: necesita Suspense en el App Router. */}
      <Suspense fallback={<SkeletonLista />}>
        <ListaGalerias />
      </Suspense>
    </div>
  );
}
