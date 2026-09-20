import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { AuditView } from '@/features/audit/audit-view';

export const metadata: Metadata = { title: 'Auditoría' };

export default function AuditPage() {
  return (
    <>
      <PageHeader
        title="Auditoría"
        description={
          'Registro append-only de toda acción relevante. No existe endpoint de modificación ni ' +
          'de borrado, y dos triggers de PostgreSQL rechazan cualquier UPDATE o DELETE sobre la tabla.'
        }
      />
      <AuditView />
    </>
  );
}
