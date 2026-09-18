import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ConsultantsTable } from '@/features/consultants/consultants-table';

export const metadata: Metadata = { title: 'Consultores' };

export default function ConsultantsPage() {
  return (
    <>
      <PageHeader
        title="Ecosistema de consultores"
        description={
          'Pool curado: ningún profesional participa sin pasar por registro, debida diligencia, ' +
          'clasificación y habilitación. Sólo el estado HABILITADO permite ver oportunidades, ' +
          'postularse y ser asignado.'
        }
      />
      <ConsultantsTable />
    </>
  );
}
