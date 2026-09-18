import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { currentUser } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={user.role} fullName={user.fullName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar role={user.role} fullName={user.fullName} email={user.email} />
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
