import { NextResponse } from 'next/server';
import { getCurrentPlatformAccess, portalLabelForRoles } from '@/lib/role-access';

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await getCurrentPlatformAccess();
  return NextResponse.json({
    data: {
      signedIn: Boolean(access.user),
      roles: access.roles,
      defaultPortal: access.defaultPortal,
      label: portalLabelForRoles(access.roles),
    },
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
