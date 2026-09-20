import { cn } from '@/lib/utils';

/**
 * Cabecera de página. Compacta: el contexto (grupo de navegación) ya lo dan las
 * migas de pan de la barra superior, así que aquí sólo va el título, una línea
 * que explica para qué sirve la pantalla y las acciones.
 *
 * `display` se reserva para el saludo del dashboard.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  size = 'default',
  className,
}: {
  title: string;
  description?: string;
  /** Línea previa en texto pequeño (p. ej. la fecha en el dashboard). */
  eyebrow?: string;
  actions?: React.ReactNode;
  size?: 'default' | 'display';
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0 max-w-3xl space-y-1">
        {eyebrow && <p className="text-caption capitalize text-muted-foreground">{eyebrow}</p>}
        <h1 className={cn('text-foreground', size === 'display' ? 'text-display' : 'text-h1')}>
          {title}
        </h1>
        {description && (
          <p className="max-w-prose text-body-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
