'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Contador opcional; se muestra en texto sólo si es > 0. */
  count?: number | null;
}

/**
 * Pestañas subrayadas (nunca con aspecto de botón). El indicador turquesa se
 * desliza a la pestaña activa: es la única animación del componente.
 *
 * Controladas y accesibles con teclado (flechas, Inicio, Fin) según el patrón
 * WAI-ARIA de tablist. En pantallas estrechas desplazan en horizontal.
 */
export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  layoutId,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  layoutId: string;
  className?: string;
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const last = items.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;

    if (target === null) return;
    event.preventDefault();
    const next = items[target];
    if (next) {
      onValueChange(next.id);
      refs.current[target]?.focus();
    }
  };

  return (
    <div className={cn('scroll-x border-b border-border', className)}>
      <div className="flex min-w-max gap-5" role="tablist">
        {items.map((item, index) => {
          const active = item.id === value;

          return (
            <button
              key={item.id}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onValueChange(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'relative flex h-10 items-center gap-1.5 whitespace-nowrap text-body transition-colors duration-fast ' +
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40',
                active
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
              {typeof item.count === 'number' && item.count > 0 && (
                <span
                  className={cn(
                    'tabular text-caption',
                    active ? 'text-ink-2' : 'text-subtle-foreground',
                  )}
                >
                  {item.count}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-brand"
                  transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
