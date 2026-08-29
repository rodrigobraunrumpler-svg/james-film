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
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <Navegacion />
        {/* El padding inferior deja sitio a la barra de publicación (fase 4),
            respetando el área segura del iPhone. */}
        {/* Columna propia para que la barra pueda ser `sticky`: pegada abajo
            mientras se scrollea, pero ocupando su hueco en vez de taparlo. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:px-8">
            {children}
          </main>
          {/* En el layout, no en el editor: navegar a otra pantalla no debe
              liberar el Wake Lock ni ocultar el progreso. */}
          <BarraSubidas />
        </div>
      </div>
    </ProveedorQuery>
  );
}
