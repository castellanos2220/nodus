import { NodusMark } from '@/components/brand/logo';
import { cn, initials } from '@/lib/utils';

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-7 text-caption',
  lg: 'size-9 text-body-sm',
} as const;

/**
 * Avatar de persona: iniciales en grafito sobre gris cálido. Sin colores por
 * usuario: el nombre al lado ya identifica, el color sólo añadiría ruido.
 * (Los tamaños de 9–10px son los únicos por debajo de la escala: iniciales
 * dentro de un círculo de 20–24px.)
 */
export function UserAvatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full bg-muted font-semibold text-ink-2',
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** El sistema como actor (bitácoras, transiciones automáticas): el símbolo N. */
export function SystemAvatar({ size = 'md' }: { size?: keyof typeof SIZES }) {
  return <NodusMark className={cn(SIZES[size], 'rounded-full')} />;
}

/** Marca de organización: cuadrado con iniciales. */
export function EntityMark({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-xs border border-border bg-card font-semibold text-ink-2',
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Persona con avatar, nombre y línea secundaria. */
export function PersonCell({
  name,
  secondary,
  size = 'sm',
}: {
  name: string;
  secondary?: React.ReactNode;
  size?: keyof typeof SIZES;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <UserAvatar name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-body-sm text-foreground">{name}</span>
        {secondary && <span className="block truncate text-caption">{secondary}</span>}
      </span>
    </span>
  );
}
