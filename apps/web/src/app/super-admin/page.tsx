import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentPlatformAccess, hasCurrentMfaLevel2 } from '@/lib/role-access';
import SuperAdminUsersClient from './SuperAdminUsersClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const managedRoles = ['user', 'admin', 'super_admin'] as const;

export default async function SuperAdminPage() {
  // Keep service-role reads behind a page-level role/MFA check even if the
  // parent layout is rendering concurrently with this server component.
  const access = await getCurrentPlatformAccess();
  if (!access.user) redirect('/login?next=/super-admin');
  if (!access.roles.includes('super_admin')) redirect(access.defaultPortal);
  if (!await hasCurrentMfaLevel2()) redirect('/account?error=mfa-required&next=/super-admin');

  const service = createServiceClient();
  const { data: authData, error: authError } = await service.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (authError) {
    return <SuperAdminUsersClient users={[]} currentUserId={access.user.id} roles={[...managedRoles]} loadError />;
  }

  const authUsers = authData.users;
  const userIds = authUsers.map((user) => user.id);
  const [profilesResult, assignmentsResult] = userIds.length
    ? await Promise.all([
      service.from('profiles').select('id,full_name,created_at').in('id', userIds),
      service.from('user_roles').select('user_id,roles(name)').in('user_id', userIds),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (profilesResult.error || assignmentsResult.error) {
    return <SuperAdminUsersClient users={[]} currentUserId={access.user.id} roles={[...managedRoles]} loadError />;
  }

  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const rolesByUserId = new Map<string, string[]>();
  for (const assignment of assignmentsResult.data ?? []) {
    const relation = assignment.roles;
    const role = Array.isArray(relation) ? relation[0] : relation;
    if (!role?.name) continue;
    rolesByUserId.set(assignment.user_id, [...(rolesByUserId.get(assignment.user_id) ?? []), role.name]);
  }

  const users = authUsers.map((user) => {
    const profile = profilesById.get(user.id);
    const metadataName = typeof user.user_metadata.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata.name === 'string' ? user.user_metadata.name : '';

    return {
      id: user.id,
      name: profile?.full_name?.trim() || metadataName.trim() || user.email?.split('@')[0] || 'Pengguna',
      email: user.email ?? '',
      createdAt: profile?.created_at ?? user.created_at,
      profileExists: Boolean(profile),
      roles: rolesByUserId.get(user.id) ?? [],
    };
  }).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  return <SuperAdminUsersClient users={users} currentUserId={access.user.id} roles={[...managedRoles]} />;
}
