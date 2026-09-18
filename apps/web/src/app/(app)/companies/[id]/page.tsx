import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, DefItem, EmptyState, TBody, TD, TH, THead, TR, Table } from '@/components/ui/primitives';
import { CaseStatusBadge } from '@/components/ui/status';
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
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) return null;
  return (await response.json()) as T;
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [company, cases] = await Promise.all([
    fetchFromApi<CompanyDetail>(`/companies/${id}`),
    fetchFromApi<CompanyCase[]>(`/companies/${id}/cases`),
  ]);

  if (!company) notFound();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Empresas
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <span className="font-mono text-xs text-muted-foreground">{company.code}</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Historial de casos</CardTitle>
            <p className="text-xs text-muted-foreground">
              Empresa única — casos múltiples: todo el historial cuelga de un solo registro
            </p>
          </CardHeader>
          <CardContent className={cases && cases.length > 0 ? 'p-0' : undefined}>
            {cases && cases.length > 0 ? (
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Caso</TH>
                    <TH>Estado</TH>
                    <TH className="text-right">Registrado</TH>
                    <TH className="text-right">Cerrado</TH>
                  </TR>
                </THead>
                <TBody>
                  {cases.map((item) => (
                    <TR key={item.id}>
                      <TD>
                        <Link href={`/cases/${item.id}`} className="group block max-w-[380px]">
                          <span className="block truncate text-sm font-medium group-hover:underline">
                            {item.title}
                          </span>
                          <span className="font-mono text-2xs text-muted-foreground">
                            {item.code}
                          </span>
                        </Link>
                      </TD>
                      <TD>
                        <CaseStatusBadge status={item.status} />
                      </TD>
                      <TD className="whitespace-nowrap text-right text-2xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </TD>
                      <TD className="whitespace-nowrap text-right text-2xs text-muted-foreground">
                        {item.closedAt ? formatDate(item.closedAt) : '—'}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <EmptyState
                icon={<Building2 className="size-8" />}
                title="Esta empresa aún no tiene casos"
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Identificación</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3.5">
                <DefItem label="NIT / identificación">
                  <span className="font-mono">{company.taxId ?? '—'}</span>
                </DefItem>
                <DefItem label="Dominio corporativo">
                  {company.emailDomain ? `@${company.emailDomain}` : '—'}
                </DefItem>
                <DefItem label="Ubicación">
                  {company.city}, {company.country}
                </DefItem>
                <DefItem label="Casos registrados">{company._count.cases}</DefItem>
                <DefItem label="Alta en la plataforma">{formatDate(company.createdAt)}</DefItem>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contactos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.contacts.map((contact) => (
                <div key={contact.id} className="space-y-0.5">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {contact.fullName}
                    {contact.isPrimary && (
                      <span className="rounded bg-accent px-1.5 py-px text-2xs font-semibold text-accent-foreground">
                        principal
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{contact.jobTitle}</p>
                  <a
                    href={`mailto:${contact.email}`}
                    className="block text-xs text-muted-foreground hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
              ))}
              {company.contacts.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin contactos registrados.</p>
              )}
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full" asChild>
            <Link href={`/cases?companyId=${company.id}`}>Ver todos sus casos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
