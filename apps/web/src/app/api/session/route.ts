import { NextResponse } from 'next/server';
import { REFRESH_COOKIE, SESSION_COOKIE, apiBaseUrl, serializeSession } from '@/lib/session';

/**
 * Inicio y cierre de sesión.
 *
 * El navegador envía las credenciales aquí; este handler llama a la API y guarda
 * los tokens en cookies `httpOnly`. El token nunca llega al JavaScript de la
 * página, de modo que un XSS no puede robarlo.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { email?: string; password?: string };

  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: 'no-store',
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  const session = {
    accessToken: payload.accessToken as string,
    refreshToken: payload.refreshToken as string,
    user: payload.user as never,
  };

  const result = NextResponse.json({ user: session.user });
  const secure = process.env.NODE_ENV === 'production';

  result.cookies.set(SESSION_COOKIE, serializeSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  result.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return result;
}

export async function DELETE(): Promise<NextResponse> {
  const result = NextResponse.json({ ok: true });
  result.cookies.delete(SESSION_COOKIE);
  result.cookies.delete(REFRESH_COOKIE);
  return result;
}
