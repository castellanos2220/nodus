import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/primitives';
import { CompaniesTable } from '@/features/companies/companies-table';

export const metadata: Metadata = { title: 'Empresas' };

export default function CompaniesPage() {
  return (
    <>
      <PageHeader
        title="Empresas"
        description={
          'Principio Empresa Única – Casos Múltiples: cada organización existe una sola vez y ' +
          'acumula todo su historial. Antes de crear una, el sistema busca coincidencias por NIT, ' +
          'correo, dominio corporativo y similitud de nombre.'
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-md" />}>
        <CompaniesTable />
      </Suspense>
    </>
  );
}
