import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { NewCaseForm } from '@/features/cases/new-case-form';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Registrar caso' };

export default async function NewCasePage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <>
      <PageHeader
        title="Registrar un caso"
        description={
          user.role === 'CLIENTE_MIPYME'
            ? 'Su empresa ya está registrada: este caso se asociará a ella automáticamente (Empresa Única – Casos Múltiples).'
            : 'Seleccione la empresa y registre la necesidad empresarial con la plantilla T1.'
        }
      />
      <NewCaseForm role={user.role} />
    </>
  );
}
