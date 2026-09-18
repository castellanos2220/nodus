'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@nodus/types';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';

interface DemoAccount {
  email: string;
  role: string;
  hint: string;
}

export function LoginForm({
  next,
  demoAccounts,
}: {
  next?: string;
  demoAccounts: DemoAccount[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setServerError(body?.message ?? 'No fue posible iniciar sesión.');
      return;
    }

    // `refresh()` fuerza a que el layout del servidor relea la cookie de sesión.
    router.replace(next && next.startsWith('/') ? next : '/dashboard');
    router.refresh();
  });

  // No lleva prefijo `use` a propósito: no es un hook, y nombrarlo así haría que
  // `rules-of-hooks` lo tratara como tal al invocarse dentro de un callback.
  const fillAccount = (email: string): void => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Nodus2026*', { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Correo electrónico" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="usuario@empresa.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Contraseña" htmlFor="password" error={errors.password?.message} required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        {serverError && (
          <div
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <p className="text-xs leading-relaxed text-destructive">{serverError}</p>
          </div>
        )}

        {/* `loading` deshabilita el botón: previene el doble envío (§35). */}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Verificando…' : 'Entrar'}
        </Button>
      </form>

      <div className="space-y-2 rounded-xl border border-dashed border-border bg-secondary/40 p-3">
        <p className="label-caps">Cuentas de demostración</p>
        <ul className="space-y-1">
          {demoAccounts.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => fillAccount(account.email)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left
                           transition-colors hover:bg-card"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{account.role}</span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {account.email}
                  </span>
                </span>
                <span className="shrink-0 text-2xs text-muted-foreground">{account.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="px-2 text-2xs text-muted-foreground">
          Contraseña para todas: <code className="font-mono">Nodus2026*</code>
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        ¿Es una Mipyme y quiere registrar una necesidad?{' '}
        <a href="/intake" className="font-medium text-foreground underline underline-offset-4">
          Abrir un caso
        </a>
      </p>
    </div>
  );
}
