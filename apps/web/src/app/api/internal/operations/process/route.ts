import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { reportServerError } from '@/lib/observability';
import { createServiceClient } from '@/lib/supabase/service';

const erpEvents = new Set(['payment.settled', 'order.paid', 'rfq.status_changed', 'quotation.responded']);

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  try {
    const service = createServiceClient();
    await Promise.all([
      service.rpc('refresh_operational_metrics', { p_metric_date: new Date().toISOString().slice(0, 10) }),
      service.rpc('refresh_customer_segments'),
    ]);
    const { data: events, error } = await service.rpc('claim_outbox_events', { p_limit: 25 });
    if (error) throw error;
    for (const event of events ?? []) {
      try {
        if (erpEvents.has(event.event_type)) await service.rpc('enqueue_erp_sync', { p_outbox_event_id: event.id, p_event_type: event.event_type, p_payload: event.payload });
        await service.rpc('complete_outbox_event', { p_id: event.id, p_success: true, p_error: null });
      } catch (eventError) {
        await service.rpc('complete_outbox_event', { p_id: event.id, p_success: false, p_error: eventError instanceof Error ? eventError.message : 'Worker error' });
      }
    }
    return NextResponse.json({ success: true, processedEvents: events?.length ?? 0 });
  } catch (error) {
    await reportServerError(error, 'operations.process');
    return NextResponse.json({ error: 'Worker operasional belum dapat diproses.' }, { status: 500 });
  }
}

export { POST as GET };
