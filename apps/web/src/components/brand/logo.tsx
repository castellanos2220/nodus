import { cn } from '@/lib/utils';

/**
 * Marca NODUS.
 *
 * El símbolo es una «N» trazada como un grafo: cuatro nodos unidos por tres
 * aristas. Tres nodos en blanco y el de llegada en turquesa: la plataforma
 * conecta a las partes y lleva el caso a destino. Se usa como logo, favicon
 * (`app/icon.svg`), avatar del actor «Sistema» y marca de la navegación.
 */
export function NodusMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-7 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path
        d="M10 22.5V9.5L22 22.5V9.5"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-card"
      />
      <circle cx="10" cy="22.5" r="2.4" className="fill-card" />
      <circle cx="10" cy="9.5" r="2.4" className="fill-card" />
      <circle cx="22" cy="22.5" r="2.4" className="fill-card" />
      <circle cx="22" cy="9.5" r="3" className="fill-brand" />
    </svg>
  );
}

/** Símbolo + palabra. */
export function NodusLogo({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <NodusMark className={size === 'lg' ? 'size-8' : 'size-7'} />
      <span
        className={cn(
          'font-semibold leading-none tracking-brand text-foreground',
          size === 'lg' ? 'text-h2' : 'text-body',
        )}
      >
        NODUS
      </span>
    </span>
  );
}
