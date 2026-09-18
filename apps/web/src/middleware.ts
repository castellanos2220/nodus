import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ['/login', '/intake', '/api/session', '/api/intake'];

/**
 * Redirección de conveniencia hacia el login.
 *
 * Es sólo eso: una redirección para no mostrar pantallas vacías. **No es una
 * medida de seguridad** — la autorización real vive en el backend, que rechaza
 * cualquier petición sin token válido aunque alguien llegue a una ruta a mano.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/proxy') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const login = new URL('/login', request.url);
    if (pathname !== '/') login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
