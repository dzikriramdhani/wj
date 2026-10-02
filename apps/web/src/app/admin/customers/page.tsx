import CustomersClient from './CustomersClient';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  const service = createServiceClient();
  const { data, error } = await service
    .from('profiles')
    .select('id,full_name,phone,created_at,user_roles(roles(name)),organization_members(organizations(name))')
    .order('created_at', { ascending: false })
    .limit(200);
  type Row = {
    id: string; full_name: string; phone: string | null; created_at: string;
    user_roles: Array<{ roles: { name: string } | { name: string }[] | null }>;
    organization_members: Array<{ organizations: { name: string } | { name: string }[] | null }>;
  };
  const customers = ((data ?? []) as Row[]).map((row) => {
    const roleRelation = row.user_roles[0]?.roles;
    const organizationRelation = row.organization_members[0]?.organizations;
    const role = Array.isArray(roleRelation) ? roleRelation[0] : roleRelation;
    const organization = Array.isArray(organizationRelation) ? organizationRelation[0] : organizationRelation;
    return {
      id: row.id,
      name: row.full_name,
      phone: row.phone ?? '-',
      role: role?.name ?? 'customer',
      organization: organization?.name ?? '-',
      createdAt: row.created_at,
    };
  });
  return <CustomersClient customers={customers} loadError={error ? 'Data customer belum dapat dimuat.' : undefined} />;
}
