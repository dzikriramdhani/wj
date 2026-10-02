import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { getCurrentPlatformAccess, requiresMfaForRoles } from '@/lib/role-access';
import type { RFQStatus } from '@/types';
import AccountClient from './AccountClient';

function safeMfaContinuePath(value: string | undefined, fallback: string) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return /^\/(admin|super-admin)(?:\/|$)/.test(value) ? value : fallback;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!hasSupabasePublicEnv()) redirect('/login?setup=supabase');

  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const access = await getCurrentPlatformAccess();
  const workspaceLinks = [
    ...(access.roles.includes('super_admin') ? [{ href: '/super-admin', label: 'Portal Super Admin' }] : []),
    ...(access.roles.includes('admin') ? [{ href: '/admin', label: 'Portal Admin' }] : []),
  ];
  const mfaRequired = requiresMfaForRoles(access.roles);
  const mfaContinueTo = safeMfaContinuePath(params.next, access.defaultPortal);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name,phone,created_at')
    .eq('id', user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organizations(name)')
    .eq('user_id', user.id)
    .limit(1);

  const { data: rfqRows } = await supabase
    .from('rfqs')
    .select('id,status,created_at,deadline,rfq_items(requested_quantity,products(name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: notificationRows } = await supabase
    .from('notifications')
    .select('id,title,body,link_path,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const organizationRelation = memberships?.[0]?.organizations;
  const organization = Array.isArray(organizationRelation)
    ? organizationRelation[0]
    : organizationRelation;

  return (
    <AccountClient
      user={{
        name: profile?.full_name ?? String(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Pelanggan'),
        email: user.email ?? '',
        phone: profile?.phone ?? String(user.user_metadata?.phone ?? '-'),
        company: organization?.name ?? '-',
        memberSince: profile?.created_at ?? user.created_at,
      }}
      rfqs={(rfqRows ?? []).map((rfq) => {
        const item = Array.isArray(rfq.rfq_items) ? rfq.rfq_items[0] : rfq.rfq_items;
        const productRelation = item?.products;
        const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
        return {
          id: rfq.id,
          status: rfq.status.toUpperCase() as RFQStatus,
          createdAt: rfq.created_at,
          deadline: rfq.deadline,
          qtyRequested: Number(item?.requested_quantity ?? 0),
          productName: product?.name ?? 'Permintaan kain custom',
        };
      })}
      notifications={(notificationRows ?? []).map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        linkPath: notification.link_path,
        readAt: notification.read_at,
        createdAt: notification.created_at,
      }))}
      workspaceLinks={workspaceLinks}
      mfaRequired={mfaRequired}
      mfaContinueTo={mfaContinueTo}
      mfaRequirement={access.roles.includes('super_admin') ? 'Super Admin' : 'Admin'}
    />
  );
}
