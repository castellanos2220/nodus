import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { QaInbox } from '@/features/proposals/qa-inbox';

export const metadata: Metadata = { title: 'QA de propuestas' };

export default function ProposalsPage() {
  return (
    <>
      <PageHeader
        title="Revisión metodológica de propuestas"
        description={
          'Bandeja de propuestas congeladas a la espera de QA. Sin una revisión metodológica ' +
          'aprobada (TP4H), la propuesta no puede enviarse al cliente.'
        }
      />
      <QaInbox />
    </>
  );
}
