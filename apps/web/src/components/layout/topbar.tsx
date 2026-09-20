'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import type { Role } from '@nodus/types';
import { ROLE_LABEL } from '@nodus/types';
import { Bell, ChevronDown, ChevronRight, LogOut, Menu, Plus, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/primitives';
import { UserAvatar } from '@/components/ui/avatar';
import { NodusLogo, NodusMark } from '@/components/brand/logo';
import { navContext } from './nav-config';
import { SidebarNav } from './sidebar';

interface NotificationItem {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  caseCode: string | null;
  caseId: string | null;
}

/**
 * Barra superior mínima: contexto a la izquierda, herramientas a la derecha.
 *
 * La acción rápida «Nuevo caso» sólo se pinta si la sesión trae el permiso
 * `CASE_CREATE`. Es presentación: el backend vuelve a comprobarlo al crear.
 */
export function Topbar({
  role,
  fullName,
  email,
  permissions,
}: {
  role: Role;
  fullName: string;
  email: string;
  permissions: string[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const context = navContext(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
      {/* Móvil: botón de menú + símbolo */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setMenuOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu />
      </Button>
      <Link href="/dashboard" className="lg:hidden" aria-label="NODUS — inicio">
        <NodusMark className="size-6" />
      </Link>

      {/* Migas de pan */}
      {context && (
        <nav aria-label="Ruta" className="hidden min-w-0 items-center gap-1.5 text-body md:flex">
          <span className="text-muted-foreground">{context.group}</span>
          <ChevronRight className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
          {context.detail ? (
            <>
              <Link
                href={context.item.href}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {context.item.label}
              </Link>
              <ChevronRight className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
              <span className="truncate font-medium text-foreground">{context.detail}</span>
            </>
          ) : (
            <span className="truncate font-medium text-foreground">{context.item.label}</span>
          )}
        </nav>
      )}

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <GlobalSearch />

        {permissions.includes('CASE_CREATE') && (
          <Button variant="secondary" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/cases/new">
              <Plus /> Nuevo caso
            </Link>
          </Button>
        )}

        <Notifications />

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />

        <UserMenu role={role} fullName={fullName} email={email} />
      </div>

      <MobileNav role={role} open={menuOpen} onOpenChange={setMenuOpen} />
    </header>
  );
}

// ------------------------------------------------------------- Búsqueda ----

/**
 * Búsqueda global de casos: lleva a `/cases?search=…`, que ya filtra por título
 * y código en el backend. `/` enfoca el campo desde cualquier pantalla.
 */
function GlobalSearch() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [term, setTerm] = React.useState('');

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative hidden md:block"
      onSubmit={(event) => {
        event.preventDefault();
        const value = term.trim();
        router.push(value ? `/cases?search=${encodeURIComponent(value)}` : '/cases');
        inputRef.current?.blur();
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        ref={inputRef}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar casos…"
        aria-label="Buscar casos por título o código"
        className="h-8 w-56 rounded-sm border border-border bg-card pl-9 pr-8 text-body-sm transition-[width,border-color,box-shadow]
                   duration-200 placeholder:text-subtle-foreground focus:w-72 focus:border-brand focus:shadow-focus
                   focus:outline-none lg:w-64"
      />
      <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
    </form>
  );
}

// -------------------------------------------------------- Notificaciones ----

function Notifications() {
  const [open, setOpen] = React.useState(false);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ unread: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => api.get<{ data: NotificationItem[] }>('/notifications', { pageSize: 8 }),
    enabled: open,
  });

  const count = unread?.unread ?? 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={`Notificaciones${count ? `: ${count} sin leer` : ''}`}
        >
          <Bell strokeWidth={1.75} />
          {count > 0 && (
            <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-brand px-1 text-[9px] font-semibold text-brand-foreground">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[22rem] overflow-hidden rounded-md border border-border bg-card shadow-pop-sm
                     data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0
                     data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-h3">Notificaciones</p>
            <span className="text-caption text-muted-foreground">{count} sin leer</span>
          </div>
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {isLoading && (
              <li className="px-4 py-6 text-center text-body-sm text-muted-foreground">
                Cargando…
              </li>
            )}
            {(notifications?.data ?? []).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.caseId ? `/cases/${item.caseId}` : '/dashboard'}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      item.readAt ? 'bg-transparent' : 'bg-brand',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'line-clamp-2 text-sm leading-snug',
                        item.readAt ? 'text-ink-2' : 'font-medium text-foreground',
                      )}
                    >
                      {item.subject}
                    </span>
                    <span className="mt-1 block text-caption text-muted-foreground">
                      {item.caseCode ? <span className="code mr-1.5">{item.caseCode}</span> : null}
                      {formatRelative(item.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {notifications && notifications.data.length === 0 && (
              <li className="px-4 py-10 text-center text-body-sm text-muted-foreground">
                No hay notificaciones
              </li>
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------- Usuario ----

function UserMenu({ role, fullName, email }: { role: Role; fullName: string; email: string }) {
  const router = useRouter();

  const logout = async (): Promise<void> => {
    await fetch('/api/session', { method: 'DELETE' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-sm py-1 pl-1 pr-1.5 transition-colors duration-fast hover:bg-muted
                     focus-visible:outline-none focus-visible:shadow-focus"
          aria-label="Menú de usuario"
        >
          <UserAvatar name={fullName} size="md" />
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block max-w-40 truncate text-body-sm font-medium">{fullName}</span>
            <span className="block max-w-40 truncate text-caption text-muted-foreground">
              {ROLE_LABEL[role]}
            </span>
          </span>
          <ChevronDown className="hidden size-3.5 text-subtle-foreground lg:block" aria-hidden />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 overflow-hidden rounded-md border border-border bg-card p-1 shadow-pop-sm
                     data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0
                     data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <UserAvatar name={fullName} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-body font-medium">{fullName}</p>
              <p className="truncate text-caption text-muted-foreground">{email}</p>
              <p className="mt-1 text-caption font-medium text-brand-strong">{ROLE_LABEL[role]}</p>
            </div>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={() => void logout()}
            className="flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2 text-body text-ink-2 outline-none
                       transition-colors data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
          >
            <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
            Cerrar sesión
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ------------------------------------------------------ Navegación móvil ----

function MobileNav({
  role,
  open,
  onOpenChange,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-foreground/30 data-[state=open]:animate-in
                     data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden"
        />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-background
                     shadow-pop duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out
                     data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Navegación</DialogPrimitive.Title>
          <div className="flex h-14 shrink-0 items-center justify-between px-5">
            <NodusLogo />
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Cerrar menú">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-6 pt-4">
            <SidebarNav
              role={role}
              layoutId="mobile-active"
              onNavigate={() => onOpenChange(false)}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
