/**
 * Cliente HTTP de la API.
 *
 * El access token vive en una cookie `httpOnly` gestionada por route handlers de
 * Next (`/api/session`), no en `localStorage`: así no es accesible al JavaScript
 * de la página y no se puede exfiltrar con un XSS. El navegador nunca ve el
 * token; es el servidor de Next quien lo adjunta al proxyar hacia la API.
 */

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path?: string;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Errores de validación de class-validator, agrupados por campo. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const result: Record<string, string> = {};
    for (const item of this.details) {
      if (typeof item === 'string') {
        const [field] = item.split(' ');
        if (field) result[field] = item;
      }
    }
    return result;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Query;
}

function buildUrl(path: string, query?: Query): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const suffix = search.toString();
  return `/api/proxy${path}${suffix ? `?${suffix}` : ''}`;
}

/**
 * Todas las llamadas del navegador pasan por `/api/proxy`, un route handler que
 * añade el token desde la cookie y reenvía a la API. El navegador nunca habla
 * directamente con el backend, de modo que el token no necesita estar en JS.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options;

  const isFormData = body instanceof FormData;

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    cache: 'no-store',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const error = payload as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Error ${response.status}`,
      error?.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => apiFetch<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
