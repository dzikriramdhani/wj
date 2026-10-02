import 'server-only';
import { requirePlatformRole } from '@/lib/role-access';

export async function requireAdminUser() {
  return requirePlatformRole(['admin', 'super_admin']);
}
