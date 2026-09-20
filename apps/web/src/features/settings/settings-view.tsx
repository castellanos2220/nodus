'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, humanizeCode } from '@/lib/utils';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import { FadeIn } from '@/components/ui/motion';
import { useLookups } from '@/features/lookups/use-lookups';

type Section = 'lookups' | 'roles' | 'templates';

export function SettingsView() {
  const [section, setSection] = React.useState<Section>('lookups');

  return (
    <div className="space-y-6">
      <Tabs<Section>
        items={[
          { id: 'lookups', label: 'Listas de valores' },
          { id: 'roles', label: 'Roles y permisos' },
          { id: 'templates', label: 'Plantillas TCOM' },
        ]}
        value={section}
        onValueChange={setSection}
        layoutId="settings-tabs"
      />

      <FadeIn key={section} role="tabpanel">
        {section === 'lookups' && <LookupsSection />}
        {section === 'roles' && <RolesSection />}
        {section === 'templates' && <TemplatesSection />}
      </FadeIn>
    </div>
  );
}

function LookupsSection() {
  const { data, isLoading } = useLookups();
  const [selected, setSelected] = React.useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-96 rounded-md" />;
  if (!data || data.length === 0) {
    return (
      <Card>
        <EmptyState title="Sin listas configuradas" />
      </Card>
    );
  }

  const active = data.find((list) => list.code === selected) ?? data[0];

  return (
    <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="self-start overflow-hidden">
        <CardHeader>
          <CardTitle>Listas</CardTitle>
          <CardDescription>{data.length} catálogos gobernados</CardDescription>
        </CardHeader>
        <ul className="space-y-0.5 px-2 pb-2">
          {data.map((list) => {
            const isActive = active?.code === list.code;
            return (
              <li key={list.code}>
                <button
                  type="button"
                  onClick={() => setSelected(list.code)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors',
                    isActive ? 'bg-brand-soft' : 'hover:bg-muted',
                  )}
                >
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block truncate text-sm',
                        isActive ? 'font-medium text-foreground' : 'text-ink-2',
                      )}
                    >
                      {list.name}
                    </span>
                    <span className="code block truncate">{list.code}</span>
                  </span>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {list.values.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {active && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{active.name}</CardTitle>
            <CardDescription>{active.description}</CardDescription>
          </CardHeader>
          <Table>
            <THead>
              <tr>
                <TH>Código</TH>
                <TH>Etiqueta</TH>
                <TH>Descripción</TH>
                <TH className="text-right">Orden</TH>
              </tr>
            </THead>
            <TBody>
              {active.values.map((value) => (
                <TR key={value.code}>
                  <TD>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                      {value.code}
                    </span>
                  </TD>
                  <TD className="text-sm">{value.label}</TD>
                  <TD className="max-w-[340px]">
                    <span className="block truncate text-xs text-muted-foreground">
                      {value.description ?? '—'}
                    </span>
                  </TD>
                  <TD className="tabular text-right text-xs text-muted-foreground">
                    {value.sortOrder}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

interface RoleRow {
  code: string;
  name: string;
  description: string | null;
  userCount: number;
  permissions: string[];
  declaredPermissions: string[];
}

function RolesSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<RoleRow[]>('/roles'),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-md" />;
  if (!data) {
    return (
      <Card>
        <EmptyState title="Sin roles configurados" />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.map((role) => {
        // Divergencia entre lo declarado en el código y lo persistido en la base.
        const drift =
          role.permissions.length !== role.declaredPermissions.length ||
          role.permissions.some((item, index) => item !== role.declaredPermissions[index]);

        return (
          <Card key={role.code}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>{role.name}</CardTitle>
                <CardDescription>{role.description}</CardDescription>
              </div>
              <div className="shrink-0 text-right">
                <span className="code block">{role.code}</span>
                <span className="tabular text-sm font-semibold">{role.userCount}</span>{' '}
                <span className="text-xs text-muted-foreground">
                  usuario{role.userCount === 1 ? '' : 's'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {drift && (
                <p className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-xs text-warning">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  Los permisos persistidos difieren de los declarados en el código. Ejecute el seed
                  de RBAC para sincronizarlos.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {role.permissions.length} permiso{role.permissions.length === 1 ? '' : 's'}
              </p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface TemplateRow {
  code: string;
  name: string;
  eventName: string;
  audiences: string[];
  subjectTemplate: string;
  channel: string;
  isActive: boolean;
  _count: { notifications: number };
}

function TemplatesSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => api.get<TemplateRow[]>('/notifications/templates'),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-md" />;
  if (!data) {
    return (
      <Card>
        <EmptyState title="Sin plantillas configuradas" />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Plantillas de comunicación</CardTitle>
        <CardDescription>
          Parametrizables: asunto, cuerpo, audiencias y canal viven en base de datos. Cada una se
          dispara por un evento de dominio y sus destinatarios se resuelven en el momento del envío.
        </CardDescription>
      </CardHeader>
      <Table>
        <THead>
          <tr>
            <TH>Código</TH>
            <TH>Nombre</TH>
            <TH>Evento disparador</TH>
            <TH>Audiencias</TH>
            <TH className="text-right">Enviadas</TH>
          </tr>
        </THead>
        <TBody>
          {data.map((template) => (
            <TR key={template.code}>
              <TD>
                <span className="tabular text-xs font-semibold">{template.code}</span>
              </TD>
              <TD className="text-sm">{template.name}</TD>
              <TD>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {template.eventName}
                </span>
              </TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {template.audiences.map((audience) => (
                    <Badge key={audience} tone="outline">
                      {humanizeCode(audience)}
                    </Badge>
                  ))}
                </div>
              </TD>
              <TD className="tabular text-right text-sm font-medium">
                {template._count.notifications}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
