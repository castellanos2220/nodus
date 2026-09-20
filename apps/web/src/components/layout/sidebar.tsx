'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import type { Role } from '@nodus/types';
import { NodusLogo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { isNavActive, navForRole } from './nav-config';

/**
 * Navegación por grupos. Se usa en el sidebar de escritorio y dentro del panel
 * lateral móvil; `layoutId` distingue ambos para que el indicador animado de uno
 * no salte al otro.
 */
export function SidebarNav({
  role,
  layoutId,
  onNavigate,
}: {
  role: Role;
  layoutId: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = navForRole(role);

  return (
    <nav className="space-y-6" aria-label="Navegación principal">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="label-caps px-3 pb-1.5">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isNavActive(pathname, item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.description}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex h-8 items-center gap-2.5 rounded-sm px-3 text-body transition-colors duration-fast',
                      active
                        ? 'font-medium text-foreground'
                        : 'text-ink-2 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={layoutId}
                        className="absolute inset-0 rounded-sm bg-brand-soft before:absolute before:left-0
                                   before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2
                                   before:rounded-full before:bg-brand"
                        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                        aria-hidden
                      />
                    )}
                    <item.icon
                      className={cn(
                        'relative size-4 shrink-0',
                        active ? 'text-brand-strong' : 'text-muted-foreground',
                      )}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="relative truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sidebar claro de escritorio: mismo lienzo que el contenido, separado por 1px. */
export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-background lg:flex">
      <div className="flex h-14 shrink-0 items-center px-5">
        <Link href="/dashboard" aria-label="NODUS — inicio" className="rounded-sm">
          <NodusLogo />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-6 pt-4">
        <SidebarNav role={role} layoutId="sidebar-active" />
      </div>

      <div className="shrink-0 border-t border-border px-5 py-3">
        <p className="text-caption text-muted-foreground">NODUS Ingeniería SAS</p>
      </div>
    </aside>
  );
}
