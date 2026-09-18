import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CaseDetailView } from '@/features/cases/case-detail/case-detail-view';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Detalle del caso' };

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { id } = await params;

  return <CaseDetailView caseId={id} role={user.role} />;
}
