import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_SESION = 'medic_session';

/**
 * Chequeo liviano en el edge: sólo valida la firma del JWT para decidir si
 * mandar al login. La verificación completa (sesión viva + permisos) se hace
 * en cada server component/action con `obtenerSesion()`.
 */
const RUTAS_PUBLICAS = ['/login', '/api/health'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_SESION)?.value;
  if (!token) return redirigirALogin(request);

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET!));
    return NextResponse.next();
  } catch {
    const respuesta = redirigirALogin(request);
    respuesta.cookies.delete(COOKIE_SESION);
    return respuesta;
  }
}

function redirigirALogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = request.nextUrl.pathname === '/' ? '' : `?siguiente=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
