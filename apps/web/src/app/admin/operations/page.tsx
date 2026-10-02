import { createServiceClient } from '@/lib/supabase/service';
import OperationsClient from './OperationsClient';
export const dynamic = 'force-dynamic';
type VerificationRow = {
  organization_id: string;
  submitted_at: string;
  organizations: { name: string } | Array<{ name: string }> | null;
};
export default async function OperationsPage() {
  const service = createServiceClient();
  const metricsStart = new Date();
  metricsStart.setUTCDate(metricsStart.getUTCDate() - 89);
  const since = metricsStart.toISOString().slice(0, 10);
  const [{ data: metrics }, { data: segmentRows }, { data: erpRows }, { count: outboxPending }, { data: verificationRows }, { data: organizations }, { data: products }] = await Promise.all([
    service.from('analytics_daily_metrics').select('metric_date,paid_order_count,paid_revenue,new_rfq_count,accepted_bulk_order_count,accepted_bulk_revenue,updated_at').gte('metric_date', since).order('metric_date'),
    service.from('customer_segment_memberships').select('segment'),
    service.from('erp_sync_jobs').select('status'),
    service.from('outbox_events').select('id', { count: 'exact', head: true }).is('processed_at', null),
    service.from('organization_verification_requests').select('organization_id,submitted_at,organizations(name)').is('decision', null).order('submitted_at').limit(50),
    service.from('organizations').select('id,name').eq('status', 'verified').order('name').limit(200),
    service.from('products').select('id,name,sku').order('name').limit(200),
  ]);
  const segments = (segmentRows ?? []).reduce<Record<string, number>>((all, row) => ({ ...all, [row.segment]: (all[row.segment] ?? 0) + 1 }), {});
  const erp = (erpRows ?? []).reduce<Record<string, number>>((all, row) => ({ ...all, [row.status]: (all[row.status] ?? 0) + 1 }), {});
  const verificationRequests = ((verificationRows ?? []) as VerificationRow[]).map((row) => ({ organizationId: row.organization_id, organizationName: (Array.isArray(row.organizations) ? row.organizations[0] : row.organizations)?.name ?? 'Perusahaan', submittedAt: row.submitted_at }));
  return <OperationsClient metrics={metrics ?? []} segments={segments} erp={erp} outboxPending={outboxPending ?? 0} verificationRequests={verificationRequests} organizations={organizations ?? []} products={products ?? []} />;
}
