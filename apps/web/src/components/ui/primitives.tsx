'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Info,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * Primitivas del Design System v2 (docs/architecture/nodus-design-system.md).
 *
 * Superficies planas con borde de 1px y radio 8; controles con radio 6; sin
 * sombras fuera de los overlays. Nada de valores arbitrarios: si un caso no
 * encaja, se extiende la primitiva, no se reescribe el estilo en la página.
 */

// ---------------------------------------------------------------- Section ----
//
// Agrupa contenido SOBRE EL LIENZO, sin caja. Un bloque de texto con título es
// una sección, no una tarjeta.

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0 space-y-0.5">
            {title && <h2 className="text-h2 text-foreground">{title}</h2>}
            {description && <p className="text-caption text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

// ------------------------------------------------------------ Panel / Card ----
//
// Panel: el contenido es un objeto delimitado (tabla, formulario, lista).
// Card es el mismo componente con otro nombre para colecciones de objetos.

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('surface', className)} {...props} />
  ),
);
Card.displayName = 'Card';

export const Panel = Card;

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('card-header flex flex-col gap-0.5 px-5 pb-3 pt-4', className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-h3 text-foreground', className)} {...props} />
);

export const CardDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-caption text-muted-foreground', className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-5 [.card-header+&]:pt-0', className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex items-center gap-2 border-t border-border px-5 py-3', className)}
    {...props}
  />
);

// ------------------------------------------------------------------ Badge ----
//
// Etiqueta neutra por defecto. Tonos semánticos sólo con significado; `brand`
// para lo seleccionado. Radio 4: una etiqueta no es una píldora.

const badgeVariants = cva(
  'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs border px-1.5 ' +
    'text-caption font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-ink-2',
        outline: 'border-border bg-card text-ink-2',
        brand: 'border-brand/25 bg-brand-soft text-brand-strong',
        success: 'border-success/20 bg-success-soft text-success',
        warning: 'border-warning/25 bg-warning-soft text-warning',
        danger: 'border-danger/20 bg-danger-soft text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

const DOT_TONE: Record<string, string> = {
  neutral: 'bg-subtle-foreground',
  outline: 'bg-subtle-foreground',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export const Badge = ({ className, tone, dot, children, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ tone }), className)} {...props}>
    {dot && (
      <span className={cn('size-1.5 rounded-full', DOT_TONE[tone ?? 'neutral'])} aria-hidden />
    )}
    {children}
  </span>
);

// ------------------------------------------------------------- Formularios ----

const controlBase =
  'w-full rounded-sm border border-border-strong bg-card text-body text-foreground ' +
  'transition-[border-color,box-shadow] duration-fast ease-standard placeholder:text-subtle-foreground ' +
  'hover:border-subtle-foreground focus-visible:border-brand focus-visible:shadow-focus ' +
  'focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:shadow-none';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input type={type} ref={ref} className={cn(controlBase, 'h-9 px-3', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(controlBase, 'min-h-[88px] px-3 py-2 leading-relaxed', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

/** Select nativo: accesible, usa el selector del sistema en móvil, sin dependencias. */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      controlBase,
      'h-9 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.5rem_center] bg-no-repeat pl-3 pr-8',
      "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B6E73' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
      className,
    )}
    {...props}
  />
));
Select.displayName = 'Select';

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn('size-4 shrink-0 cursor-pointer rounded-xs accent-brand', className)}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn('text-label text-ink-2', className)} {...props} />
));
Label.displayName = 'Label';

/** Campo: etiqueta visible, control, y ayuda o error (el error sustituye a la ayuda). */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-subtle-foreground" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-caption text-danger" role="alert">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Sección de formulario: título y ayuda a la izquierda, campos a la derecha.
 * En pantallas estrechas se apila.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-x-8 gap-y-4 border-b border-border-subtle py-6 first:pt-0 last:border-b-0 last:pb-0 md:grid-cols-[220px_minmax(0,1fr)]',
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="text-h3">{title}</h3>
        {description && <p className="text-caption text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------- Avisos en línea ----

const NOTICE = {
  info: {
    icon: Info,
    box: 'border-border bg-muted/60 text-ink-2',
    iconTone: 'text-muted-foreground',
  },
  success: {
    icon: CheckCircle2,
    box: 'border-success/20 bg-success-soft text-ink-2',
    iconTone: 'text-success',
  },
  warning: {
    icon: AlertTriangle,
    box: 'border-warning/25 bg-warning-soft text-ink-2',
    iconTone: 'text-warning',
  },
  danger: {
    icon: AlertCircle,
    box: 'border-danger/20 bg-danger-soft text-danger',
    iconTone: 'text-danger',
  },
} as const;

/** Aviso en línea: información, confirmación, advertencia o error, siempre con icono. */
export function InlineNotice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof NOTICE;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, box, iconTone } = NOTICE[tone];
  return (
    <div
      className={cn('flex items-start gap-3 rounded-sm border px-3.5 py-3', box, className)}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconTone)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5 text-body-sm">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Error de servidor dentro de formularios y diálogos. */
export function FormError({ children }: { children: React.ReactNode }) {
  return <InlineNotice tone="danger">{children}</InlineNotice>;
}

// -------------------------------------------------------------- Separator ----

export const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
));
Separator.displayName = 'Separator';

// --------------------------------------------------------------- Progress ----

export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('relative h-1 w-full overflow-hidden rounded-full bg-muted', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        'h-full w-full flex-1 bg-brand transition-transform duration-base',
        indicatorClassName,
      )}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = 'Progress';

// --------------------------------------------------------------- Skeleton ----

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('animate-pulse rounded-sm bg-muted', className)} {...props} />
);

// ------------------------------------------------------------------ Table ----
//
// Tabla de uso intensivo. `density` fija la altura de fila (48 / 40px); las
// celdas la leen del grupo `table`. Cabeceras en sentence case, separadores
// sutiles, hover apenas perceptible.

export type TableDensity = 'comfortable' | 'compact';

export const Table = ({
  className,
  density = 'comfortable',
  ...props
}: React.HTMLAttributes<HTMLTableElement> & { density?: TableDensity }) => (
  <div className="scroll-x">
    <table
      data-density={density}
      className={cn('group/table w-full border-collapse text-body-sm', className)}
      {...props}
    />
  </div>
);

export const THead = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('border-b border-border', className)} {...props} />
);

export const TBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('divide-y divide-border-subtle', className)} {...props} />
);

export const TR = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('transition-colors duration-fast hover:bg-muted/50', className)} {...props} />
);

export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      'h-9 whitespace-nowrap px-3 text-left align-middle text-label text-muted-foreground first:pl-5 last:pr-5',
      className,
    )}
    {...props}
  />
);

export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn(
      'h-12 px-3 py-2 align-middle first:pl-5 last:pr-5 group-data-[density=compact]/table:h-10 group-data-[density=compact]/table:py-1',
      className,
    )}
    {...props}
  />
);

/** Cabecera ordenable: el orden lo aplica el backend (`sortBy` / `sortDir`). */
export function SortHeader({
  label,
  active,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: () => void;
  align?: 'left' | 'right';
}) {
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        'inline-flex items-center gap-1 rounded-xs text-label transition-colors hover:text-foreground',
        active ? 'text-foreground' : 'text-muted-foreground',
        align === 'right' && 'flex-row-reverse',
      )}
      aria-label={`Ordenar por ${label.toLowerCase()}`}
    >
      {label}
      <Icon className={cn('size-3', !active && 'opacity-50')} aria-hidden />
    </button>
  );
}

/** Filas de esqueleto con la forma de la tabla final. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border-subtle" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex h-12 items-center gap-6 px-5">
          {Array.from({ length: columns }).map((__, column) => (
            <Skeleton
              key={column}
              className={cn('h-3', column === 0 ? 'w-56' : column % 2 ? 'w-24' : 'w-32')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------- Vacío y error ----

/**
 * Estado vacío: qué falta, por qué importa y qué puede hacer el usuario. Sin
 * ilustración ni icono en caja: el texto hace el trabajo.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-1 px-6 py-10 text-center', className)}>
      {icon && <div className="mb-1 text-subtle-foreground [&_svg]:size-5">{icon}</div>}
      <p className="text-body font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-md text-body-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Error de carga con reintento. El mensaje dice qué falló, en llano. */
export function ErrorState({
  title = 'No se pudo cargar la información',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center gap-1 px-6 py-10 text-center', className)}
      role="alert"
    >
      <AlertCircle className="mb-1 size-5 text-danger" aria-hidden />
      <p className="text-body font-medium text-foreground">{title}</p>
      {message && (
        <p className="max-w-md text-body-sm leading-relaxed text-muted-foreground">{message}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-card px-3 text-body-sm font-medium transition-colors hover:bg-muted"
        >
          <RotateCw className="size-3.5" aria-hidden /> Reintentar
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------- Definición ----

/** Par etiqueta/valor de las fichas de detalle. */
export function DefItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-0.5', className)}>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-body text-foreground">{children}</dd>
    </div>
  );
}

// -------------------------------------------------------------------- Kbd ----

export const Kbd = ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
  <kbd
    className={cn(
      'inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border bg-muted px-1 font-mono text-caption text-muted-foreground',
      className,
    )}
    {...props}
  />
);
