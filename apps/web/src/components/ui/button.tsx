'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Botones.
 *
 *   primary    turquesa, texto tinta — la acción principal de la zona (una).
 *   secondary  blanco con borde — acciones secundarias. `outline` es alias.
 *   subtle     relleno gris suave — acciones terciarias.
 *   ghost      sin fondo — barras de herramientas e iconos.
 *   danger     sólo destructivas. `destructive` es alias.
 *   link       texto de marca.
 *
 * Planos: sin gradientes ni sombras. Radio 6. Alturas 32 · 36 · 40.
 */
const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm text-body ' +
    'font-medium transition-colors duration-fast ease-standard focus-visible:outline-none ' +
    'focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-foreground hover:bg-brand/90 active:bg-brand/80',
        secondary:
          'border border-border-strong bg-card text-foreground hover:border-subtle-foreground hover:bg-muted/60',
        subtle: 'bg-muted text-foreground hover:bg-border/70',
        ghost: 'text-ink-2 hover:bg-muted hover:text-foreground',
        danger: 'bg-danger text-danger-foreground hover:bg-danger/90',
        link: 'h-auto px-0 text-brand-strong underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3 text-body-sm [&_svg]:size-3.5',
        lg: 'h-10 px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type Variant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;

const VARIANT_ALIASES: Record<string, Variant> = {
  primary: 'default',
  outline: 'secondary',
  destructive: 'danger',
};

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, 'variant'> {
  variant?: Variant | 'primary' | 'outline' | 'destructive';
  asChild?: boolean;
  /** Estado *processing*: spinner, deshabilitado — impide el doble envío (§35). */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const resolved = variant ? (VARIANT_ALIASES[variant] ?? (variant as Variant)) : undefined;

    return (
      <Comp
        className={cn(buttonVariants({ variant: resolved, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
