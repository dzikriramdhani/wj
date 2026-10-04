export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { getCurrentPlatformAccess, hasCurrentMfaLevel2, requiresMfaForRoles } from '@/lib/role-access';
import AdminShell from './AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabasePublicEnv()) redirect('/login?setup=supabase');

  const access = await getCurrentPlatformAccess();
  if (!access.user) redirect('/login?next=/admin');
  if (!access.roles.some((role) => role === 'admin' || role === 'super_admin')) redirect(access.defaultPortal);
  if (requiresMfaForRoles(access.roles) && !await hasCurrentMfaLevel2()) redirect('/account?error=mfa-required&next=/admin');
  const userName = access.user.email?.split('@')[0] ?? 'Administrator';
  return <AdminShell portal="admin" userName={userName}>{children}</AdminShell>;
}

