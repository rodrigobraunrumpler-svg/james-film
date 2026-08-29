import { Suspense } from 'react';
import {
  PanelConfiguracion,
  SkeletonConfiguracion,
} from '@/features/configuracion/components/panel-configuracion';

export const metadata = { title: 'Configuración · James Film' };

export default function Page() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold tracking-[-0.01em]">Configuración</h1>
      {/* nuqs lee la URL: necesita Suspense en el App Router. */}
      <Suspense fallback={<SkeletonConfiguracion />}>
        <PanelConfiguracion />
      </Suspense>
    </div>
  );
}
