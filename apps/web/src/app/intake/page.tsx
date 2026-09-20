import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { NodusLogo } from '@/components/brand/logo';
import { IntakeForm } from '@/features/intake/intake-form';

export const metadata: Metadata = {
  title: 'Registrar una necesidad',
  description: 'Abra un caso en NODUS en menos de tres minutos.',
};

export default function IntakePage() {
  return (
    <main className="relative min-h-screen bg-background">
      <div className="grid-backdrop pointer-events-none absolute inset-x-0 top-0 h-80 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <header className="relative border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/login" aria-label="NODUS">
            <NodusLogo />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-foreground"
          >
            Ya tengo cuenta <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </header>

      <div className="container relative max-w-3xl py-14">
        <div className="mb-10 space-y-4">
          <p className="label-caps text-brand-strong">Registro de necesidad · 3 minutos</p>
          <h1 className="text-4xl font-semibold">Cuéntenos qué necesita resolver</h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            No hay proceso de inscripción: describa su necesidad y la plataforma abre el caso. A
            partir de ahí, el equipo advisory analiza, clasifica y busca al consultor adecuado
            dentro del ecosistema.
          </p>
        </div>

        <IntakeForm />
      </div>
    </main>
  );
}
