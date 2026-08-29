import { ProveedorQuery } from '@/lib/query/proveedor';
import { Navegacion } from '@/components/shared/navegacion';
import { BarraSubidas } from '@/lib/media/cola/barra-subidas';

/**
 * Server Component: no lleva estado. Los hijos que sí lo necesitan marcan
 * `'use client'` en la hoja — marcarlo aquí arrastraría el árbol entero.
 */
export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorQuery>
      <div className="bg-content flex min-h-dvh flex-col lg:flex-row">
        <Navegacion />
        {/* Columna propia para que la barra de subidas pueda ser `sticky`:
            pegada abajo mientras se scrollea, pero ocupando su hueco en vez de
            taparlo. Con `fixed` tapaba el botón de Cancelar de la última tarjeta. */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* ARRIBA y en el flujo: ocupa su hueco en vez de taparle a la última
              tarjeta el botón de Cancelar. En el layout y no en el editor,
              para que navegar no libere el Wake Lock ni oculte el progreso. */}
          <BarraSubidas />
          {/* El padding inferior respeta el área segura del iPhone. */}
          <main className="flex-1 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:px-6">
            {children}
          </main>
        </div>
      </div>
    </ProveedorQuery>
  );
}
