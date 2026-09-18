import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/auth/login-form';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Iniciar sesión' };

const DEMO_ACCOUNTS = [
  { email: 'advisory@nodus.local', role: 'Advisory / PMO', hint: 'Gobierna el proceso completo' },
  { email: 'maria.restrepo@acerosdelnorte.com', role: 'Cliente Mipyme', hint: 'Crea casos y decide' },
  { email: 'ana.velez@consultor.nodus.local', role: 'Consultora', hint: 'Se postula y ejecuta' },
  { email: 'revisor@nodus.local', role: 'Consultor revisor', hint: 'Peer review de propuestas' },
  { email: 'admin@nodus.local', role: 'Super administrador', hint: 'Gobierno de plataforma' },
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
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,480px)]">
      {/* Panel de marca: no se muestra en móvil para no robar espacio al formulario. */}
      <section className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-foreground/10 font-mono text-sm font-bold">
            N
          </div>
          <span className="text-sm font-semibold tracking-[0.2em]">NODUS</span>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            Orquestación empresarial con trazabilidad completa
          </h1>
          <p className="text-sm leading-relaxed text-sidebar-muted">
            Del registro de una necesidad al cierre formal del caso: clasificación gobernada,
            bolsa curada de consultores, propuestas versionadas, control de SLA y bitácora
            inmutable de cada decisión.
          </p>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-sidebar-border pt-6">
            {[
              ['17', 'estados del ciclo de vida'],
              ['21', 'transiciones gobernadas'],
              ['5', 'roles con permisos propios'],
              ['100 %', 'de acciones auditadas'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-mono text-xl font-semibold">{value}</dt>
                <dd className="text-xs text-sidebar-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-2xs text-sidebar-muted">
          NODUS Ingeniería SAS · Plataforma orquestadora neutral
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 lg:hidden">
            <span className="font-mono text-sm font-bold tracking-[0.2em]">NODUS</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground">
              Acceda con las credenciales de su cuenta.
            </p>
          </div>

          <LoginForm next={next} demoAccounts={DEMO_ACCOUNTS} />
        </div>
      </section>
    </main>
  );
}
