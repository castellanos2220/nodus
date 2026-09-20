'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@nodus/types';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/primitives';
import { UserAvatar } from '@/components/ui/avatar';

interface DemoAccount {
  email: string;
  role: string;
  hint: string;
}

export function LoginForm({ next, demoAccounts }: { next?: string; demoAccounts: DemoAccount[] }) {
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
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label="Correo electrónico" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="usuario@empresa.com"
            className="h-10"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Contraseña" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            className="h-10"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        {serverError && <FormError>{serverError}</FormError>}

        {/* `loading` deshabilita el botón: previene el doble envío (§35). */}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Verificando…' : 'Entrar'}
          {!isSubmitting && <ArrowRight />}
        </Button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <p className="label-caps">Cuentas de demostración</p>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {demoAccounts.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => fillAccount(account.email)}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <UserAvatar name={account.role} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{account.role}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {account.email}
                  </span>
                </span>
                <span className="hidden shrink-0 text-2xs text-muted-foreground sm:block">
                  {account.hint}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-center text-xs text-muted-foreground">
          Contraseña para todas: <code className="font-mono text-foreground">Nodus2026*</code>
        </p>
      </div>
    </div>
  );
}
