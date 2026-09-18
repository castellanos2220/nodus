import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { SlaView } from '@/features/sla/sla-view';

export const metadata: Metadata = { title: 'SLA' };

export default function SlaPage() {
  return (
    <>
      <PageHeader
        title="Control de niveles de servicio"
        description={
          'Ninguna duración está escrita en código: las reglas son filas de base de datos y se ' +
          'resuelven por especificidad (etapa más dimensiones coincidentes) en tiempo de ejecución.'
        }
      />
      <SlaView />
    </>
  );
}
