import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import RFQClient from './RFQClient';
import type { RFQ, RFQStatus } from '@/types';

export default async function AdminRFQPage() {
  if (!hasSupabasePublicEnv()) return <RFQClient rfqs={[]} />;

  const supabase = await createClient();
  const { data } = await supabase
    .from('rfqs')
    .select('id,user_id,status,specifications,deadline,created_at,rfq_items(id,product_id,requested_quantity,custom_specifications,products(name)),quotations(revision,quotation_approvals(note,decision,created_at))')
    .order('created_at', { ascending: false });

  const rfqs = (data ?? []).map((row): RFQ & { revisionNotes: Array<{ revision: number; note: string; createdAt: string }> } => {
    const item = Array.isArray(row.rfq_items) ? row.rfq_items[0] : row.rfq_items;
    const productRelation = item?.products;
    const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
    const specs = row.specifications as RFQ['specDetails'];
    const quotationRelations = row.quotations as unknown as Array<{
      revision: number;
      quotation_approvals: { note: string | null; decision: string; created_at: string } | Array<{ note: string | null; decision: string; created_at: string }> | null;
    }> | null;
    const revisionNotes = (quotationRelations ?? []).flatMap((quotation) => {
      const approval = Array.isArray(quotation.quotation_approvals) ? quotation.quotation_approvals[0] : quotation.quotation_approvals;
      return approval?.decision === 'rejected' && approval.note
        ? [{ revision: quotation.revision, note: approval.note, createdAt: approval.created_at }]
        : [];
    });
    return {
      id: row.id,
      userId: row.user_id,
      productId: item?.product_id ?? undefined,
      productName: product?.name ?? String((specs as Record<string, unknown>)?.jenisKain ?? 'Permintaan kain custom'),
      specDetails: specs,
      qtyRequested: Number(item?.requested_quantity ?? 0),
      deadline: row.deadline ?? undefined,
      status: row.status.toUpperCase() as RFQStatus,
      attachments: [],
      createdAt: row.created_at,
      revisionNotes,
    };
  });

  return <RFQClient rfqs={rfqs} />;
}
