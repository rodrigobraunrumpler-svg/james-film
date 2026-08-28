import { QueryCache, QueryClient } from '@tanstack/react-query';
import { esApiError } from '../api/errors';

/**
 * `onSesionMuerta` lo enchufa el provider: cuando la sesión muere, se limpia la
 * caché y se va al login desde UN sitio. Sin esto, cada pantalla tendría que
 * manejarlo por su cuenta y alguna se olvidaría.
 */
export function crearQueryClient(onSesionMuerta: () => void): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (esApiError(error) && error.esSesionMuerta) onSesionMuerta();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // No reintentar lo que no se arregla reintentando: un 404 o un 422 no
        // cambian por insistir, y cada reintento retrasa el mensaje de error.
        retry: (intentos, error) => esApiError(error) && error.isRetryable && intentos < 2,
        // James trabaja desde el móvil cambiando de app: refetchear en cada
        // vuelta al foco gastaría sus datos sin que él lo pida.
        refetchOnWindowFocus: false,
      },
      // Una mutación reintentada puede duplicar un efecto. Las que se pueden
      // reintentar lo hacen explícitamente, no por defecto.
      mutations: { retry: false },
    },
  });
}
