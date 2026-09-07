import { Suspense } from 'react';
import {
  PanelConfiguracion,
  SkeletonConfiguracion,
} from '@/features/configuracion/components/panel-configuracion';

export const metadata = { title: 'Configuración · James Film' };

export default function Page() {
  // El h1 vive DENTRO del panel, con su bajada y sus pestañas: aquí había un
  // segundo `<h1>Configuración</h1>` y la pantalla lo pintaba dos veces.
  // nuqs lee la URL, así que necesita Suspense en el App Router.
  return (
    <Suspense fallback={<SkeletonConfiguracion />}>
      <PanelConfiguracion />
    </Suspense>
  );
}
