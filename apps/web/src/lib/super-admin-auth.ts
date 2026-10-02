import 'server-only';

import { getCurrentPlatformAccess, hasCurrentMfaLevel2 } from '@/lib/role-access';

export async function requireSuperAdminUser() {
  const access = await getCurrentPlatformAccess();
  if (!access.user || !access.roles.includes('super_admin')) return null;

  if (!await hasCurrentMfaLevel2()) return null;
  return access.user;
}
