'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Control segmentado para filtros o vistas de pocas opciones (≤ 6): todas a la
 * vista, un clic. Radio 6, sin sombra; la opción activa es una superficie
 * blanca con borde.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  layoutId,
  ariaLabel,
  className,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onValueChange: (value: T) => void;
  layoutId: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        // `overflow-x-auto` y no `.scroll-x`: esa clase fuerza `w-full`.
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-sm border border-border bg-muted p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'relative h-7 shrink-0 whitespace-nowrap rounded-xs px-2.5 text-body-sm transition-colors duration-fast',
              active
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xs border border-border bg-card"
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                aria-hidden
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {option.label}
              {typeof option.count === 'number' && (
                <span className="tabular text-caption text-muted-foreground">{option.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
