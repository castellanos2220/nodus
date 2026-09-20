import { NextResponse } from 'next/server';
import { forwardedHeaders } from '@/lib/forwarding';
import { apiBaseUrl } from '@/lib/session';

/**
 * Proxy público del onboarding T1.
 *
 * El intake es el único flujo sin sesión: la Mipyme no se inscribe primero y
 * abre un caso después, entra abriendo un caso. Este handler reenvía sin token;
 * la protección contra abuso está en la política PUBLIC del límite de tasa de
 * la API (5 registros por 10 minutos e IP; ver ADR-009).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.text();

  const response = await fetch(`${apiBaseUrl()}/intake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Se propaga la IP del cliente para que el límite de tasa y la bitácora la vean.
      ...forwardedHeaders(request.headers),
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

export async function GET(request: Request): Promise<NextResponse> {
  const response = await fetch(`${apiBaseUrl()}/lookups/public/intake`, {
    headers: forwardedHeaders(request.headers),
    cache: 'no-store',
  });
  const payload = await response.text();

  return new NextResponse(payload, {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  });
}
