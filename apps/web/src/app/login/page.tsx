import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NodusLogo } from '@/components/brand/logo';
import { NodeField } from '@/components/brand/node-field';
import { LoginForm } from '@/features/auth/login-form';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Iniciar sesión' };

const DEMO_ACCOUNTS = [
  { email: 'advisory@nodus.local', role: 'Advisory / PMO', hint: 'Gobierna el proceso completo' },
  {
    email: 'maria.restrepo@acerosdelnorte.com',
    role: 'Cliente Mipyme',
    hint: 'Crea casos y decide',
  },
  { email: 'ana.velez@consultor.nodus.local', role: 'Consultora', hint: 'Se postula y ejecuta' },
  { email: 'revisor@nodus.local', role: 'Consultor revisor', hint: 'Peer review de propuestas' },
  { email: 'admin@nodus.local', role: 'Super administrador', hint: 'Gobierno de plataforma' },
];

const FACTS: Array<[string, string]> = [
  ['17', 'estados del ciclo de vida'],
  ['21', 'transiciones gobernadas'],
  ['5', 'roles con permisos propios'],
  ['100%', 'de acciones auditadas'],
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect('/dashboard');

  const { next } = await searchParams;

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.1fr)_minmax(460px,1fr)]">
      {/* Panel de marca: claro, tipográfico. Oculto en móvil para no robar espacio al formulario. */}
      <section className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:gap-10 lg:px-14 lg:py-12">
        <div className="grid-backdrop pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_40%,black_20%,transparent_75%)]" />

        <NodusLogo size="lg" className="relative" />

        <div className="relative max-w-xl space-y-8">
          <NodeField className="w-full max-w-[300px] xl:max-w-[360px]" />

          <div className="space-y-5">
            <h1 className="text-4xl font-semibold text-foreground xl:text-[3.25rem] xl:leading-[1.05]">
              Control empresarial
              <br />
              moderno<span className="text-brand">.</span>
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              Del registro de una necesidad al cierre formal del caso: clasificación gobernada,
              consultores curados, propuestas versionadas, SLA y una bitácora inmutable de cada
              decisión.
            </p>
          </div>

          <dl className="grid max-w-lg grid-cols-4 gap-6 border-t border-border pt-6">
            {FACTS.map(([value, label]) => (
              <div key={label} className="space-y-1">
                <dt className="text-2xl font-semibold text-foreground">{value}</dt>
                <dd className="text-xs leading-snug text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-muted-foreground">
          NODUS Ingeniería SAS · Plataforma orquestadora neutral
        </p>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center bg-card px-6 py-12 sm:px-10">
        <div className="w-full max-w-[400px] space-y-8">
          <NodusLogo className="lg:hidden" />

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground">
              Acceda con las credenciales de su cuenta.
            </p>
          </div>

          <LoginForm next={next} demoAccounts={DEMO_ACCOUNTS} />

          <p className="text-center text-sm text-muted-foreground">
            ¿Es una Mipyme y quiere registrar una necesidad?{' '}
            <Link href="/intake" className="link">
              Abrir un caso
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
