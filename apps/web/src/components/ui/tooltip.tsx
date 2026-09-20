'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

/**
 * Tooltip para valores truncados, fechas relativas y botones de icono. Nunca
 * para información que el usuario necesita para actuar: esa va a la vista.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <TooltipPrimitive.Root delayDuration={350}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-xs rounded-xs bg-foreground px-2 py-1 text-caption text-card shadow-pop-sm',
            'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
