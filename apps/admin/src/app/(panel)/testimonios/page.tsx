import { Suspense } from 'react';
import {
  ListaTestimonios,
  SkeletonTestimonios,
} from '@/features/testimonios/components/lista-testimonios';

export const metadata = { title: 'Testimonios · James Film' };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Testimonios</h1>
      {/* nuqs lee la URL: necesita Suspense en el App Router. */}
      <Suspense fallback={<SkeletonTestimonios />}>
        <ListaTestimonios />
      </Suspense>
    </div>
  );
}
