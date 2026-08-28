import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE } from '@/lib/api/server/session';

/**
 * `middleware.ts` está DEPRECADO en Next 16 y se llama `proxy.ts`. Verificado en
 * la documentación que trae next@16.3.3.
 *
 * Solo comprueba PRESENCIA de la cookie: no hace red ni verifica firmas, porque
 * corre en cada navegación. La validez la decide la API, y si el token ya no vale
 * la pasarela devuelve 401 y el cliente vuelve aquí.
 *
 * Esto es lo que elimina el parpadeo de contenido protegido: la redirección ocurre
 * antes de pintar nada.
 */
export function proxy(req: NextRequest): NextResponse {
  if (req.cookies.has(COOKIE)) return NextResponse.next();

  const login = new URL('/login', req.url);
  login.searchParams.set('desde', req.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // TODO `/api` queda fuera: proxy.ts protege PÁGINAS, y de las llamadas se
    // ocupa la pasarela devolviendo 401. Si entraran aquí, un fetch() sin sesión
    // seguiría el 307 y recibiría el HTML del login donde espera JSON.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|login|api/).*)',
  ],
};
