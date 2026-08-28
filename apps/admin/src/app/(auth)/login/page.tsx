import { Suspense } from 'react';
import { FormularioLogin } from '@/features/auth/components/formulario-login';

export const metadata = { title: 'Entrar · James Film' };

/** Ruta fina: importa la feature y ya. Sin lógica ni fetch aquí. */
export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-semibold">James Film</h1>
      {/* useSearchParams exige Suspense en el App Router. */}
      <Suspense fallback={null}>
        <FormularioLogin />
      </Suspense>
    </main>
  );
}
