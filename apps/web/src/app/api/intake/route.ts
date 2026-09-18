import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/session';

/**
 * Proxy público del onboarding T1.
 *
 * El intake es el único flujo sin sesión: la Mipyme no se inscribe primero y
 * abre un caso después, entra abriendo un caso. Este handler reenvía sin token;
 * la protección contra abuso está en el rate limit estricto del endpoint de la
 * API (5 solicitudes por 10 minutos e IP).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.text();

  const response = await fetch(`${apiBaseUrl()}/intake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Se propaga la IP del cliente para que el rate limit y la bitácora la vean.
      'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
    },
    body,
    cache: 'no-store',
  });

  const payload = await response.text();

  return new NextResponse(payload, {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(): Promise<NextResponse> {
  const response = await fetch(`${apiBaseUrl()}/lookups/public/intake`, { cache: 'no-store' });
  const payload = await response.text();

  return new NextResponse(payload, {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  });
}
