'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './primitives';

/** Barra de filtros: una sola fila sobre la tabla, discreta. */
export function FilterBar({
  children,
  trailing,
  className,
}: {
  children: React.ReactNode;
  /** Contenido alineado a la derecha (contador de resultados, acciones). */
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}

/** Campo de búsqueda con icono y botón para limpiar. */
export const SearchInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
    value: string;
    onValueChange: (value: string) => void;
    containerClassName?: string;
  }
>(({ value, onValueChange, containerClassName, className, ...props }, ref) => (
  <div className={cn('relative min-w-[220px] flex-1', containerClassName)}>
    <Search
      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
      strokeWidth={1.75}
      aria-hidden
    />
    <Input
      ref={ref}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      className={cn('pl-9 pr-8', className)}
      {...props}
    />
    {value && (
      <button
        type="button"
        onClick={() => onValueChange('')}
        className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded
                   text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Limpiar búsqueda"
      >
        <X className="size-3.5" />
      </button>
    )}
  </div>
));
SearchInput.displayName = 'SearchInput';
