import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, FolderKanban, Mail } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DefItem,
  EmptyState,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui/primitives';
import { EntityMark, UserAvatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status';
import { forwardedHeaders } from '@/lib/forwarding';
import { apiBaseUrl, readSession } from '@/lib/session';
import { formatDate } from '@/lib/utils';
import type { CaseStatusCode } from '@nodus/types';

export const metadata: Metadata = { title: 'Detalle de empresa' };

interface CompanyDetail {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  emailDomain: string | null;
  country: string;
  city: string;
  sectorCode: string | null;
  website: string | null;
  createdAt: string;
  contacts: Array<{
    id: string;
    fullName: string;
    jobTitle: string;
    email: string;
    phone: string;
    isPrimary: boolean;
  }>;
  _count: { cases: number };
}

interface CompanyCase {
  id: string;
  code: string;
  title: string;
  status: CaseStatusCode;
  areaCode: string | null;
  complexityCode: string | null;
  createdAt: string;
  closedAt: string | null;
}

/**
 * Detalle de empresa renderizado en el servidor.
 *
 * Es una pantalla de lectura sin interacción: hacerla server component evita
 * enviar JavaScript al cliente para algo que no lo necesita.
 */
async function fetchFromApi<T>(path: string): Promise<T | null> {
  const session = await readSession();
  if (!session) return null;

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...forwardedHeaders(await headers()),
    },
    cache: 'no-store',
  });

  if (!response.ok) return null;
  return (await response.json()) as T;
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [company, cases] = await Promise.all([
    fetchFromApi<CompanyDetail>(`/companies/${id}`),
    fetchFromApi<CompanyCase[]>(`/companies/${id}/cases`),
  ]);

  if (!company) notFound();

  const open = (cases ?? []).filter((item) => !item.closedAt).length;

  return (
    <div className="space-y-6">
      <Link
        href="/companies"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Todas las empresas
      </Link>

      {/* Cabecera */}
      <Card>
        <div className="flex flex-wrap items-start gap-5 p-6 sm:p-8">
          <EntityMark name={company.name} size="lg" className="size-14 rounded-md text-base" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="code text-xs">{company.code}</span>
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{company.name}</h1>
            <p className="text-sm text-muted-foreground">
              {company.city}, {company.country}
              {company.emailDomain && <> · @{company.emailDomain}</>}
            </p>
          </div>
        </div>
        <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-3 [&>div]:bg-card">
          <Stat label="Casos registrados" value={company._count.cases} />
          <Stat label="Casos abiertos" value={open} />
          <Stat label="Contactos" value={company.contacts.length} />
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Historial de casos</CardTitle>
            <CardDescription>
              Empresa única — casos múltiples: todo el historial cuelga de un solo registro
            </CardDescription>
          </CardHeader>
          {cases && cases.length > 0 ? (
            <Table>
              <THead>
                <tr>
                  <TH>Caso</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Registrado</TH>
                  <TH className="text-right">Cerrado</TH>
                </tr>
              </THead>
              <TBody>
                {cases.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <Link href={`/cases/${item.id}`} className="group block max-w-[380px]">
                        <span className="block truncate text-sm font-medium group-hover:text-brand-strong">
                          {item.title}
                        </span>
                        <span className="code">{item.code}</span>
                      </Link>
                    </TD>
                    <TD>
                      <StatusBadge status={item.status} variant="plain" />
                    </TD>
                    <TD className="whitespace-nowrap text-right text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </TD>
                    <TD className="whitespace-nowrap text-right text-xs text-muted-foreground">
                      {item.closedAt ? formatDate(item.closedAt) : '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState icon={<FolderKanban />} title="Esta empresa aún no tiene casos" />
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Identificación</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <DefItem label="NIT / identificación">
                  <span className="font-mono text-sm">{company.taxId ?? '—'}</span>
                </DefItem>
                <DefItem label="Dominio corporativo">
                  {company.emailDomain ? `@${company.emailDomain}` : '—'}
                </DefItem>
                <DefItem label="Ubicación">
                  {company.city}, {company.country}
                </DefItem>
                <DefItem label="Alta en la plataforma">{formatDate(company.createdAt)}</DefItem>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contactos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {company.contacts.map((contact) => (
                <div key={contact.id} className="flex gap-3">
                  <UserAvatar name={contact.fullName} size="md" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {contact.fullName}
                      {contact.isPrimary && (
                        <span className="rounded bg-brand-soft px-1.5 py-px text-2xs font-medium text-brand-strong">
                          Principal
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{contact.jobTitle}</p>
                    <a
                      href={`mailto:${contact.email}`}
                      className="link inline-flex items-center gap-1 text-xs"
                    >
                      <Mail className="size-3" aria-hidden />
                      {contact.email}
                    </a>
                  </div>
                </div>
              ))}
              {company.contacts.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin contactos registrados.</p>
              )}
            </CardContent>
          </Card>

          <Link
            href={`/cases?companyId=${company.id}`}
            className="group flex items-center justify-between rounded-md border border-border bg-card px-5 py-3.5 text-sm font-medium transition-colors hover:bg-muted/50"
          >
            Ver todos sus casos
            <ArrowUpRight
              className="size-4 text-subtle-foreground transition-colors group-hover:text-foreground"
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-6 py-4 sm:px-8">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}
