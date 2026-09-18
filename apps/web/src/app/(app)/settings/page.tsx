import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsView } from '@/features/settings/settings-view';

export const metadata: Metadata = { title: 'Configuración' };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Gobierno de plataforma"
        description={
          'Listas de valores, matriz de roles y plantillas de comunicación. Ninguna clasificación ' +
          'crítica del sistema acepta texto libre: todas apuntan a un código de estas listas.'
        }
      />
      <SettingsView />
    </>
  );
}
