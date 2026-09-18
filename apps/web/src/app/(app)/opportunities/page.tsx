import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { OpportunitiesView } from '@/features/opportunities/opportunities-view';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Oportunidades' };

export default async function OpportunitiesPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <>
      <PageHeader
        title="Bolsa interna de oportunidades"
        description={
          'Espacio curado, no un marketplace abierto: sólo aparecen los casos para los que su ' +
          'perfil es elegible según especialidad, nivel, complejidad habilitada y alcance.'
        }
      />
      <OpportunitiesView />
    </>
  );
}
