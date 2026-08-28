'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { useState } from 'react';
import { crearQueryClient } from './cliente';

/**
 * El QueryClient se crea con `useState` y no como singleton de módulo: en el App
 * Router el módulo se comparte entre peticiones del servidor, y un cliente global
 * filtraría la caché de un usuario a otro. Con un solo usuario no se notaría, pero
 * es exactamente el tipo de fallo que no quieres descubrir más tarde.
 */
export function ProveedorQuery({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [cliente] = useState(() =>
    crearQueryClient(() => {
      // La pasarela ya intentó refrescar: si llega un 401, la sesión murió.
      // Se limpia la caché para que la siguiente sesión no vea datos ajenos.
      cliente.clear();
      router.replace('/login');
    }),
  );

  return (
    <QueryClientProvider client={cliente}>
      {/* nuqs necesita su adaptador para el App Router. */}
      <NuqsAdapter>{children}</NuqsAdapter>
    </QueryClientProvider>
  );
}
