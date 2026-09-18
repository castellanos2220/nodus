'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@nodus/types';
import { ROLE_LABEL } from '@nodus/types';
import { cn } from '@/lib/utils';
import { navForRole } from './nav-config';

export function Sidebar({ role, fullName }: { role: Role; fullName: string }) {
  const pathname = usePathname();
  const groups = navForRole(role);

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-foreground/10 font-mono text-xs font-bold">
          N
        </div>
        <span className="text-sm font-semibold tracking-[0.18em]">NODUS</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-2 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-sidebar-muted">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                // `startsWith` para que /cases/<id> mantenga activo "Casos".
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.description}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        active
                          ? 'bg-sidebar-accent font-medium text-sidebar-foreground'
                          : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="truncate text-xs font-medium">{fullName}</p>
        <p className="truncate text-2xs text-sidebar-muted">{ROLE_LABEL[role]}</p>
      </div>
    </aside>
  );
}
