import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  const endpoint = process.env.ERP_WEBHOOK_URL;
  const secret = process.env.ERP_WEBHOOK_SECRET;
  if (!endpoint || !secret) return NextResponse.json({ error: 'ERP belum dikonfigurasi.' }, { status: 503 });
  try {
    const service = createServiceClient();
    const { data: jobs, error } = await service.rpc('claim_erp_sync_jobs', { p_limit: 20 });
    if (error) throw error;
    for (const job of jobs ?? []) {
      const timestamp = new Date().toISOString();
      const body = JSON.stringify({ id: job.id, eventType: job.event_type, occurredAt: timestamp, payload: job.payload });
      const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WinaJaya-Timestamp': timestamp, 'X-WinaJaya-Signature': `sha256=${signature}` }, body, signal: AbortSignal.timeout(12_000) });
        if (!response.ok) throw new Error(`ERP responded ${response.status}`);
        await service.rpc('complete_erp_sync_job', { p_id: job.id, p_success: true, p_error: null });
      } catch (jobError) {
        await service.rpc('complete_erp_sync_job', { p_id: job.id, p_success: false, p_error: jobError instanceof Error ? jobError.message : 'ERP request failed' });
      }
    }
    return NextResponse.json({ success: true, processedJobs: jobs?.length ?? 0 });
  } catch (error) {
    console.error('ERP worker failed', error);
    return NextResponse.json({ error: 'Sinkronisasi ERP belum dapat diproses.' }, { status: 500 });
  }
}
