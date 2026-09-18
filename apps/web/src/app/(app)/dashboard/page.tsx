import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ROLE_LABEL } from '@nodus/types';
import { PageHeader } from '@/components/layout/page-header';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Dashboard' };

const DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: 'Estado global de la plataforma: operación, cumplimiento y ecosistema.',
  ADVISORY: 'Estado de la operación y casos que requieren su intervención.',
  CONSULTOR: 'Sus casos asignados, hitos comprometidos y entregables pendientes.',
  CONSULTOR_REVISOR: 'Propuestas en revisión y aportes al ecosistema.',
  CLIENTE_MIPYME: 'Estado de los casos de su empresa dentro de la plataforma.',
};

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <>
      <PageHeader
        title={`Hola, ${user.fullName.split(' ')[0]}`}
        description={DESCRIPTIONS[user.role] ?? ROLE_LABEL[user.role]}
      />
      <DashboardView role={user.role} />
    </>
  );
}
