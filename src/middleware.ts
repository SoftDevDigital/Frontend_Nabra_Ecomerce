import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Headers de seguridad
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // Headers de caché para assets estáticos
  if (request.nextUrl.pathname.startsWith('/_next/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // Headers de caché para imágenes
  if (request.nextUrl.pathname.match(/\.(jpg|jpeg|png|gif|ico|svg|webp|avif)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // Headers de caché para el manifest
  if (request.nextUrl.pathname === '/manifest.json') {
    response.headers.set('Cache-Control', 'public, max-age=86400'); // 1 día
  }

  // Headers de caché para robots.txt
  if (request.nextUrl.pathname === '/robots.txt') {
    response.headers.set('Cache-Control', 'public, max-age=86400'); // 1 día
  }

  // Headers de caché para sitemap.xml
  if (request.nextUrl.pathname === '/sitemap.xml') {
    response.headers.set('Cache-Control', 'public, max-age=3600'); // 1 hora
  }

  // Preload de recursos críticos
  if (request.nextUrl.pathname === '/') {
    response.headers.set('Link', '</logoNabra.png>; rel=preload; as=image, </zapateria.jpeg>; rel=preload; as=image');
  }

  // Compresión
  response.headers.set('Vary', 'Accept-Encoding');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

