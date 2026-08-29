import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Sin esto, los componentes de un test siguen montados en el siguiente y los
// queries encuentran dos coincidencias donde debería haber una.
afterEach(cleanup);

/**
 * `useRouter` fuera del App Router lanza «invariant expected app router to be
 * mounted». Va en el setup y no en cada spec porque le pasa a TODO componente
 * que navegue, y repetir el mock en cinco ficheros garantiza que el sexto se
 * olvide.
 *
 * Los espías se exponen para que un test pueda aseverar la navegación.
 */
export const navegacion = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  // El login precarga el panel al montar: sin este espía, `router.prefetch`
  // es undefined y el componente revienta antes de pintar nada.
  prefetch: vi.fn(),
};

vi.mock('next/navigation', async (importar) => {
  const real = await importar<Record<string, unknown>>();
  return {
    ...real,
    useRouter: () => navegacion,
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  };
});

afterEach(() => {
  for (const espia of Object.values(navegacion)) espia.mockClear();
});
