'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@nodus/types';
import { ROLE_LABEL } from '@nodus/types';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatRelative, initials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { navForRole } from './nav-config';

interface NotificationItem {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  caseCode: string | null;
  caseId: string | null;
}

export function Topbar({
  role,
  fullName,
  email,
}: {
  role: Role;
  fullName: string;
  email: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [bellOpen, setBellOpen] = React.useState(false);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ unread: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () =>
      api.get<{ data: NotificationItem[] }>('/notifications', { pageSize: 8 }),
    enabled: bellOpen,
  });

  const logout = async (): Promise<void> => {
    await fetch('/api/session', { method: 'DELETE' });
    router.replace('/login');
    router.refresh();
  };

  const groups = navForRole(role);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Abrir menú"
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>

        <div className="lg:hidden">
          <span className="font-mono text-sm font-bold tracking-[0.18em]">NODUS</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setBellOpen((open) => !open)}
              aria-label={`Notificaciones${unread?.unread ? `: ${unread.unread} sin leer` : ''}`}
            >
              <Bell />
              {(unread?.unread ?? 0) > 0 && (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {unread!.unread > 9 ? '9+' : unread!.unread}
                </span>
              )}
            </Button>

            {bellOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-hidden
                  onClick={() => setBellOpen(false)}
                />
                <div className="surface absolute right-0 z-50 mt-2 w-80 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <p className="text-xs font-semibold">Notificaciones</p>
                    <span className="text-2xs text-muted-foreground">
                      {unread?.unread ?? 0} sin leer
                    </span>
                  </div>
                  <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                    {(notifications?.data ?? []).map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.caseId ? `/cases/${item.caseId}` : '#'}
                          onClick={() => setBellOpen(false)}
                          className={cn(
                            'block px-4 py-2.5 transition-colors hover:bg-secondary/60',
                            !item.readAt && 'bg-accent/40',
                          )}
                        >
                          <p className="truncate text-xs font-medium">{item.subject}</p>
                          <p className="mt-0.5 text-2xs text-muted-foreground">
                            {item.caseCode ? `${item.caseCode} · ` : ''}
                            {formatRelative(item.createdAt)}
                          </p>
                        </Link>
                      </li>
                    ))}
                    {notifications && notifications.data.length === 0 && (
                      <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                        No hay notificaciones
                      </li>
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 border-l border-border pl-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-2xs font-semibold text-primary-foreground">
              {initials(fullName)}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-xs font-medium leading-tight">{fullName}</p>
              <p className="truncate text-2xs text-muted-foreground">{ROLE_LABEL[role]}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión" title={email}>
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      {/* Navegación móvil */}
      {menuOpen && (
        <nav className="border-b border-border bg-card px-4 py-3 lg:hidden">
          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="label-caps px-1 pb-1">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                        pathname.startsWith(item.href)
                          ? 'bg-secondary font-medium'
                          : 'text-muted-foreground',
                      )}
                    >
                      <item.icon className="size-4" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      )}
    </>
  );
}
