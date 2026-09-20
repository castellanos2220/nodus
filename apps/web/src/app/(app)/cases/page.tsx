import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { CasesTable } from '@/features/cases/cases-table';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Casos' };

const DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: 'Todos los casos de la plataforma y su posición en el ciclo de vida.',
  ADVISORY: 'Todos los casos bajo veeduría, con su estado, responsable y SLA.',
  CONSULTOR: 'Los casos en los que participa: asignados y postulados.',
  CONSULTOR_REVISOR: 'Casos con propuestas en revisión metodológica.',
  CLIENTE_MIPYME: 'Los casos registrados por su empresa y su avance.',
};

export default async function CasesPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const canCreate = user.permissions.includes('CASE_CREATE');

  return (
    <>
      <PageHeader
        title="Casos"
        description={DESCRIPTIONS[user.role]}
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/cases/new">
                <Plus /> Registrar caso
              </Link>
            </Button>
          )
        }
      />

      <Suspense fallback={<Skeleton className="h-96 rounded-md" />}>
        <CasesTable />
      </Suspense>
    </>
  );
}
