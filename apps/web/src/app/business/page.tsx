import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import BusinessClient from './BusinessClient';
export const dynamic = 'force-dynamic';

type OrganizationMemberRole = 'owner' | 'admin' | 'buyer' | 'viewer';
type BusinessDocument = { name: string; path: string };
type OrganizationRelation = {
  id: string;
  name: string;
  legal_name: string | null;
  status: string;
  business_profiles: { industry: string | null; website: string | null; documents: BusinessDocument[] | null } | Array<{ industry: string | null; website: string | null; documents: BusinessDocument[] | null }> | null;
  organization_verification_requests: { decision: string | null; review_notes: string | null; submitted_at: string } | Array<{ decision: string | null; review_notes: string | null; submitted_at: string }> | null;
};
type MembershipRow = { organization_id: string; role: OrganizationMemberRole; organizations: OrganizationRelation | OrganizationRelation[] | null };
const organizationMemberRoles: OrganizationMemberRole[] = ['owner', 'admin', 'buyer', 'viewer'];

function isOrganizationMemberRole(value: string): value is OrganizationMemberRole {
  return organizationMemberRoles.includes(value as OrganizationMemberRole);
}

export default async function BusinessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: memberships }, { data: quotes }] = await Promise.all([
    supabase
      .from('organization_members')
      .select('organization_id,role,organizations(id,name,legal_name,status,business_profiles(industry,website,documents),organization_verification_requests(decision,review_notes,submitted_at))')
      .eq('user_id', user.id)
      .order('joined_at'),
    supabase
      .from('quotations')
      .select('id,revision,status,payment_terms,valid_until,created_at,rfq_id,quotation_items(description,quantity,unit_price,line_total),bulk_orders(bulk_order_number,status,total_amount)')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const managerOrganizationIds = (memberships ?? [])
    .filter((membership) => membership.role === 'owner' || membership.role === 'admin')
    .map((membership) => membership.organization_id);
  const { data: memberRows } = managerOrganizationIds.length
    ? await createServiceClient()
      .from('organization_members')
      .select('organization_id,user_id,role,profiles!organization_members_user_id_fkey(full_name)')
      .in('organization_id', managerOrganizationIds)
    : { data: [] };

  const membersByOrganization = new Map<string, Array<{ userId: string; name: string; role: OrganizationMemberRole }>>();
  for (const row of (memberRows ?? []) as Array<{
    organization_id: string;
    user_id: string;
    role: string;
    profiles: { full_name: string } | Array<{ full_name: string }> | null;
  }>) {
    if (!isOrganizationMemberRole(row.role)) continue;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const current = membersByOrganization.get(row.organization_id) ?? [];
    current.push({ userId: row.user_id, name: profile?.full_name ?? 'Pengguna', role: row.role });
    membersByOrganization.set(row.organization_id, current);
  }

  const organizations = ((memberships ?? []) as MembershipRow[]).map((row) => {
    const relation = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    const profile = Array.isArray(relation?.business_profiles) ? relation.business_profiles[0] : relation?.business_profiles;
    const verification = Array.isArray(relation?.organization_verification_requests) ? relation.organization_verification_requests[0] : relation?.organization_verification_requests;
    return relation ? {
      id: relation.id,
      name: relation.name,
      legalName: relation.legal_name ?? '',
      status: relation.status,
      role: row.role,
      industry: profile?.industry ?? '',
      website: profile?.website ?? '',
      documents: profile?.documents ?? [],
      verification,
      members: membersByOrganization.get(relation.id) ?? [],
    } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return <BusinessClient organizations={organizations} quotations={quotes ?? []} currentUserId={user.id} />;
}
