import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentPlatformAccess } from '@/lib/role-access';
import SuperAdminUsersClient from './SuperAdminUsersClient';

export const dynamic = 'force-dynamic';

const managedRoles = ['admin', 'super_admin'] as const;

export default async function SuperAdminPage() {
  const service = createServiceClient();
  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    service
      .from('profiles')
      .select('id,full_name,phone,created_at,user_roles(roles(name))')
      .order('created_at', { ascending: false })
      .limit(500),
    service.auth.admin.listUsers({ page: 1, perPage: 500 }),
  ]);
  const access = await getCurrentPlatformAccess();
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
