'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Diálogo modal: velo sólido translúcido (sin desenfoque), panel con radio 10
 * y la única sombra fuerte del sistema. Aparece con un fundido corto; cabecera
 * y pie quedan fijos y el cuerpo desplaza por dentro.
 */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { wide?: boolean }
>(({ className, children, wide, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className="fixed inset-0 z-50 bg-foreground/30 duration-base data-[state=open]:animate-in
                 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 ' +
          '-translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-pop ' +
          'duration-base data-[state=open]:animate-in data-[state=closed]:animate-out ' +
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        wide ? 'max-w-3xl' : 'max-w-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-sm text-muted-foreground
                   transition-colors duration-fast hover:bg-muted hover:text-foreground focus-visible:outline-none
                   focus-visible:shadow-focus"
      >
        <X className="size-4" />
        <span className="sr-only">Cerrar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('shrink-0 space-y-1 border-b border-border px-5 pb-4 pr-12 pt-4', className)}
    {...props}
  />
);

export const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-5', className)} {...props} />
);

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-5 py-3 sm:flex-row sm:justify-end',
      className,
    )}
    {...props}
  />
);

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-h2', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-body-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';
