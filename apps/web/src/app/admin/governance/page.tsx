import { createServiceClient } from '@/lib/supabase/service';
import GovernanceClient from './GovernanceClient';
export const dynamic = 'force-dynamic';
type ProfileRelation = { full_name: string } | Array<{ full_name: string }> | null;
type SubjectRequestRow = { id: string; request_type: string; status: string; note: string | null; created_at: string; profiles: ProfileRelation };
type AuditRow = { id: number; action: string; entity_type: string; created_at: string; profiles: ProfileRelation };
export default async function GovernancePage() {
  const service = createServiceClient();
  const [{ data: requests }, { data: auditRows }, { data: securityRows }] = await Promise.all([
    service.from('data_subject_requests').select('id,request_type,status,note,resolution_note,created_at,profiles(full_name)').order('created_at', { ascending: false }).limit(100),
    service.from('audit_logs').select('id,action,entity_type,entity_id,created_at,profiles(full_name)').order('created_at', { ascending: false }).limit(100),
    service.from('security_events').select('id,event_type,severity,created_at').order('created_at', { ascending: false }).limit(100),
  ]);
  const records = ((requests ?? []) as SubjectRequestRow[]).map((item) => ({ id: item.id, type: item.request_type, status: item.status, note: item.note, createdAt: item.created_at, user: (Array.isArray(item.profiles) ? item.profiles[0] : item.profiles)?.full_name ?? 'Pengguna' }));
  const audit = ((auditRows ?? []) as AuditRow[]).map((item) => ({ id: item.id, action: item.action, entity: item.entity_type, createdAt: item.created_at, user: (Array.isArray(item.profiles) ? item.profiles[0] : item.profiles)?.full_name ?? 'Sistem' }));
  return <GovernanceClient requests={records} audits={audit} securityEvents={securityRows ?? []} />;
}
