import 'server-only';

import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export const platformRoles = ['user', 'admin', 'super_admin'] as const;
export type PlatformRole = (typeof platformRoles)[number];

export type PlatformAccess = {
  user: { id: string; email?: string } | null;
  roles: PlatformRole[];
  defaultPortal: string;
};

function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === 'string' && (platformRoles as readonly string[]).includes(value);
}

export function defaultPortalForRoles(roles: readonly PlatformRole[]) {
  if (roles.includes('super_admin')) return '/super-admin';
  if (roles.includes('admin')) return '/admin';
  return '/account';
}

export function portalLabelForRoles(roles: readonly PlatformRole[]) {
  if (roles.includes('super_admin')) return 'Portal Super Admin';
  if (roles.includes('admin')) return 'Portal Admin';
  return 'Akun Saya';
}

export function requiresMfaForRoles(roles: readonly PlatformRole[]) {
  return roles.includes('super_admin')
    || ((process.env.NODE_ENV === 'production' || process.env.ADMIN_MFA_REQUIRED === 'true') && roles.includes('admin'));
}

export function roleNamesFromAssignments(assignments: Array<{ roles?: unknown }> | null | undefined) {
  const names = (assignments ?? []).flatMap((assignment) => {
    const relation = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
    const name = relation && typeof relation === 'object' && 'name' in relation
      ? (relation as { name?: unknown }).name
      : undefined;
    return isPlatformRole(name) ? [name] : [];
  });

  return platformRoles.filter((role) => names.includes(role));
}

export async function getCurrentPlatformAccess(): Promise<PlatformAccess> {
  if (!hasSupabasePublicEnv()) {
    return { user: null, roles: [], defaultPortal: '/account' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, roles: [], defaultPortal: '/account' };

  const { data: assignments } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id);
  const roles = roleNamesFromAssignments(assignments);

  return {
    user: { id: user.id, email: user.email },
    roles,
    defaultPortal: defaultPortalForRoles(roles),
  };
}

export async function hasCurrentMfaLevel2() {
  if (!hasSupabasePublicEnv()) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data?.currentLevel === 'aal2';
}

export async function requirePlatformRole(allowedRoles: readonly PlatformRole[]) {
  const access = await getCurrentPlatformAccess();
  if (!access.user || !access.roles.some((role) => allowedRoles.includes(role))) return null;
  if (requiresMfaForRoles(access.roles) && !await hasCurrentMfaLevel2()) return null;
  return access.user;
}
