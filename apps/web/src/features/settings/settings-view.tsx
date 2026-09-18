'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks, Mail, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui/primitives';
import { useLookups } from '@/features/lookups/use-lookups';

type Section = 'lookups' | 'roles' | 'templates';

export function SettingsView() {
  const [section, setSection] = React.useState<Section>('lookups');

  const tabs: Array<{ id: Section; label: string; icon: typeof ListChecks }> = [
    { id: 'lookups', label: 'Listas de valores', icon: ListChecks },
    { id: 'roles', label: 'Roles y permisos', icon: ShieldCheck },
    { id: 'templates', label: 'Plantillas TCOM', icon: Mail },
  ];

  return (
    <div className="space-y-4">
      <div className="scroll-x border-b border-border">
        <div className="flex min-w-max gap-0.5" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={section === tab.id}
              onClick={() => setSection(tab.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
                section === tab.id
                  ? 'border-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="size-4" aria-hidden />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {section === 'lookups' && <LookupsSection />}
      {section === 'roles' && <RolesSection />}
      {section === 'templates' && <TemplatesSection />}
    </div>
  );
}

function LookupsSection() {
  const { data, isLoading } = useLookups();
  const [selected, setSelected] = React.useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data || data.length === 0) return <EmptyState title="Sin listas configuradas" />;

  const active = data.find((list) => list.code === selected) ?? data[0];

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Listas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {data.map((list) => (
              <li key={list.code}>
                <button
                  type="button"
                  onClick={() => setSelected(list.code)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors',
                    active?.code === list.code ? 'bg-accent/50' : 'hover:bg-secondary/50',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{list.name}</span>
                    <span className="block truncate font-mono text-2xs text-muted-foreground">
                      {list.code}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                    {list.values.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {active && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{active.name}</CardTitle>
            <p className="text-xs leading-relaxed text-muted-foreground">{active.description}</p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Código</TH>
                  <TH>Etiqueta</TH>
                  <TH>Descripción</TH>
                  <TH className="text-right">Orden</TH>
                </TR>
              </THead>
              <TBody>
                {active.values.map((value) => (
                  <TR key={value.code}>
                    <TD className="font-mono text-2xs">{value.code}</TD>
                    <TD className="text-sm">{value.label}</TD>
                    <TD className="max-w-[320px]">
                      <span className="block truncate text-xs text-muted-foreground">
                        {value.description ?? '—'}
                      </span>
                    </TD>
                    <TD className="text-right font-mono text-2xs text-muted-foreground">
                      {value.sortOrder}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
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

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <EmptyState title="Sin roles configurados" />;

  return (
    <div className="space-y-3">
      {data.map((role) => {
        // Divergencia entre lo declarado en el código y lo persistido en la base.
        const drift =
          role.permissions.length !== role.declaredPermissions.length ||
          role.permissions.some((item, index) => item !== role.declaredPermissions[index]);

        return (
          <Card key={role.code}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{role.name}</CardTitle>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {role.description}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-mono text-2xs text-muted-foreground">{role.code}</span>
                <p className="text-xs">
                  {role.userCount} usuario{role.userCount === 1 ? '' : 's'}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {drift && (
                <p className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-2xs">
                  Los permisos persistidos difieren de los declarados en el código. Ejecute el seed
                  de RBAC para sincronizarlos.
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((permission) => (
                  <Badge key={permission} tone="outline" className="font-mono normal-case">
                    {permission}
                  </Badge>
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

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <EmptyState title="Sin plantillas configuradas" />;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Plantillas de comunicación</CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Parametrizables: asunto, cuerpo, audiencias y canal viven en base de datos. Cada una se
          dispara por un evento de dominio y sus destinatarios se resuelven en el momento del envío.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Código</TH>
              <TH>Nombre</TH>
              <TH>Evento disparador</TH>
              <TH>Audiencias</TH>
              <TH className="text-right">Enviadas</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((template) => (
              <TR key={template.code}>
                <TD className="font-mono text-2xs font-semibold">{template.code}</TD>
                <TD className="text-sm">{template.name}</TD>
                <TD>
                  <span className="font-mono text-2xs text-muted-foreground">
                    {template.eventName}
                  </span>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {template.audiences.map((audience) => (
                      <Badge key={audience} tone="outline">
                        {audience.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    ))}
                  </div>
                </TD>
                <TD className="text-right font-mono text-xs">{template._count.notifications}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
