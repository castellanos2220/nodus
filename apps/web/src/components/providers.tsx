'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * TanStack Query es el **único** almacén de estado de servidor de la aplicación.
 *
 * No hay un store global paralelo (ver `docs/architecture/source-discrepancies.md`
 * D-05): duplicar el estado de servidor en un store es la vía más rápida a que la
 * pantalla y la base digan cosas distintas.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Los datos de workflow cambian por acción del usuario, no solos:
            // se revalidan al volver a la ventana y tras cada mutación.
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // No tiene sentido reintentar un 401/403/404: el resultado sería
              // el mismo y sólo añade latencia y ruido.
              if (error instanceof ApiError && error.status < 500) return false;
              return failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {/* Respeta `prefers-reduced-motion`: sin animaciones si el sistema lo pide. */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider>{children}</TooltipProvider>
      </MotionConfig>
      {/* Toasts neutros: el icono lleva el significado, no un fondo de color. */}
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{
          classNames: {
            toast:
              'group !rounded-md !border !border-border !bg-card !text-foreground !shadow-pop !font-sans',
            title: '!text-body !font-medium',
            description: '!text-body-sm !text-muted-foreground',
            success: '[&_[data-icon]]:!text-success',
            error: '[&_[data-icon]]:!text-danger',
            warning: '[&_[data-icon]]:!text-warning',
            closeButton: '!border-border !bg-card !text-muted-foreground',
          },
        }}
      />
    </QueryClientProvider>
  );
}
