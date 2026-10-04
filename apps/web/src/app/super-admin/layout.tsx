export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { getCurrentPlatformAccess } from '@/lib/role-access';
import { requireSuperAdminUser } from '@/lib/super-admin-auth';
import AdminShell from '@/app/admin/AdminShell';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabasePublicEnv()) redirect('/login?setup=supabase');

  const access = await getCurrentPlatformAccess();
  if (!access.user) redirect('/login?next=/super-admin');
  if (!access.roles.includes('super_admin')) redirect(access.defaultPortal);
  if (!await requireSuperAdminUser()) redirect('/account?error=mfa-required&next=/super-admin');

  return (
    <AdminShell portal="super-admin" userName={access.user.email?.split('@')[0] ?? 'Super Admin'}>
      {children}
    </AdminShell>
  );
}

