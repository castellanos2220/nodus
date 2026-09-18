import { cookies } from 'next/headers';
import type { Role } from '@nodus/types';

export const SESSION_COOKIE = 'nodus_session';
export const REFRESH_COOKIE = 'nodus_refresh';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: string[];
  companyId: string | null;
  consultantId: string | null;
  mustChangePassword: boolean;
}

export interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/** URL interna de la API: dentro de Docker es el servicio, fuera es localhost. */
export function apiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:4000/api/v1'
  );
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
}

export function serializeSession(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Usuario autenticado, o `null`.
 *
 * Es información de conveniencia para la interfaz. **Ningún permiso se decide
 * aquí**: la autorización real la resuelve el backend en cada petición, y si el
 * frontend se equivoca al mostrar algo, el backend responde 403.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await readSession();
  return session?.user ?? null;
}
