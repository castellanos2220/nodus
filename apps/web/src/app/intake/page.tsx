import type { Metadata } from 'next';
import Link from 'next/link';
import { IntakeForm } from '@/features/intake/intake-form';

export const metadata: Metadata = {
  title: 'Registrar una necesidad',
  description: 'Abra un caso en NODUS en menos de tres minutos.',
};

export default function IntakePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-mono text-sm font-bold tracking-[0.18em]">NODUS</span>
          <Link
            href="/login"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </header>

      <div className="container max-w-3xl py-10">
        <div className="mb-8 space-y-2">
          <h1 className="text-2xl font-semibold leading-tight">Cuéntenos qué necesita resolver</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            No hay proceso de inscripción: describa su necesidad y la plataforma abre el caso. Le
            tomará menos de tres minutos. A partir de ahí, el equipo advisory analiza, clasifica y
            busca al consultor adecuado dentro del ecosistema.
          </p>
        </div>

        <IntakeForm />
      </div>
    </main>
  );
}
