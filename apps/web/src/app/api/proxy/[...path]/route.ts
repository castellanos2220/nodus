import { NextResponse } from 'next/server';
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  apiBaseUrl,
  readSession,
  serializeSession,
} from '@/lib/session';

/**
 * Proxy autenticado hacia la API.
 *
 * Toda llamada del navegador pasa por aquí. El handler adjunta el access token
 * desde la cookie `httpOnly` y, si la API responde 401, intenta **una** rotación
 * del refresh token y reintenta la petición original de forma transparente.
 *
 * Que el navegador no vea nunca el token es el punto: no hay token en
 * `localStorage`, no hay token en memoria del cliente, no hay token que robar.
 */
async function handle(request: Request, path: string[]): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { statusCode: 401, code: 'NO_SESSION', message: 'Sesión no iniciada' },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const target = `${apiBaseUrl()}/${path.join('/')}${url.search}`;

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  const forward = async (accessToken: string): Promise<Response> => {
    const headers = new Headers();
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    headers.set('authorization', `Bearer ${accessToken}`);

    const requestId = request.headers.get('x-request-id');
    if (requestId) headers.set('x-request-id', requestId);

    return fetch(target, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: 'no-store',
    });
  };

  interface RefreshedTokens {
    accessToken: string;
    refreshToken: string;
    user: unknown;
  }

  let apiResponse = await forward(session.accessToken);
  let refreshed: RefreshedTokens | null = null;

  if (apiResponse.status === 401) {
    const refresh = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: 'no-store',
    });

    if (refresh.ok) {
      refreshed = (await refresh.json()) as RefreshedTokens;
      if (refreshed) {
        apiResponse = await forward(refreshed.accessToken);
      }
    }
  }

  const payload = await apiResponse.arrayBuffer();
  const result = new NextResponse(payload, {
    status: apiResponse.status,
    headers: {
      'content-type': apiResponse.headers.get('content-type') ?? 'application/json',
    },
  });

  // Si hubo rotación, se persisten los tokens nuevos en la misma respuesta.
  if (refreshed) {
    const secure = process.env.NODE_ENV === 'production';
    result.cookies.set(
      SESSION_COOKIE,
      serializeSession({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        user: refreshed.user as never,
      }),
      { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 7 },
    );
    result.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return result;
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  return handle(request, (await context.params).path);
}
export async function POST(request: Request, context: Context) {
  return handle(request, (await context.params).path);
}
export async function PATCH(request: Request, context: Context) {
  return handle(request, (await context.params).path);
}
export async function PUT(request: Request, context: Context) {
  return handle(request, (await context.params).path);
}
export async function DELETE(request: Request, context: Context) {
  return handle(request, (await context.params).path);
}
