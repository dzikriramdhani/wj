import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentPlatformAccess, hasCurrentMfaLevel2 } from '@/lib/role-access';
import SuperAdminUsersClient from './SuperAdminUsersClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const managedRoles = ['admin', 'super_admin'] as const;

export default async function SuperAdminPage() {
  // Keep service-role reads behind a page-level role/MFA check even if the
  // parent layout is rendering concurrently with this server component.
  const access = await getCurrentPlatformAccess();
  if (!access.user) redirect('/login?next=/super-admin');
  if (!access.roles.includes('super_admin')) redirect(access.defaultPortal);
  if (!await hasCurrentMfaLevel2()) redirect('/account?error=mfa-required&next=/super-admin');

  const service = createServiceClient();
  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    service
      .from('profiles')
      .select('id,full_name,phone,created_at,user_roles(roles(name))')
      .order('created_at', { ascending: false })
      .limit(500),
    service.auth.admin.listUsers({ page: 1, perPage: 500 }),
  ]);
  const emailById = new Map((authUsers?.users ?? []).map((user) => [user.id, user.email ?? '']));

  const users = ((profiles ?? []) as Array<{
    id: string;
    full_name: string;
    phone: string | null;
    created_at: string;
    user_roles: Array<{ roles: { name: string } | Array<{ name: string }> | null }>;
  }>).map((profile) => ({
    id: profile.id,
    name: profile.full_name,
    email: emailById.get(profile.id) ?? '',
    createdAt: profile.created_at,
    roles: profile.user_roles.flatMap((assignment) => {
      const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
      return role?.name ? [role.name] : [];
    }),
  }));

  return <SuperAdminUsersClient users={users} currentUserId={access.user?.id ?? ''} roles={[...managedRoles]} />;
}
