import 'server-only';

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

function providerBaseUrl() {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';
}

export type ReconciliationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

export async function reconcileMidtransPayment(orderId: string): Promise<ReconciliationResult> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) return { ok: false, status: 503, error: 'Midtrans belum dikonfigurasi.' };

  try {
    const service = createServiceClient();
    const { data: payment, error: paymentError } = await service
      .from('payments')
      .select('provider_order_id')
      .eq('order_id', orderId)
      .eq('provider', 'midtrans')
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) return { ok: false, status: 404, error: 'Pembayaran Midtrans belum dibuat untuk pesanan ini.' };

    const response = await fetch(`${providerBaseUrl()}/${encodeURIComponent(payment.provider_order_id)}/status`, {
      headers: { Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const notification = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) return { ok: false, status: 503, error: 'Status pembayaran belum dapat diambil dari Midtrans.' };

    const transactionStatus = String(notification.transaction_status ?? '');
    const grossAmount = Number(notification.gross_amount);
    const statusCode = String(notification.status_code ?? '');
    if (!transactionStatus || !Number.isFinite(grossAmount) || !statusCode) {
      return { ok: false, status: 502, error: 'Respons Midtrans tidak lengkap.' };
    }

    const fingerprint = createHash('sha256').update(JSON.stringify({
      source: 'reconciliation',
      orderId: payment.provider_order_id,
      transactionId: notification.transaction_id ?? '',
      transactionStatus,
      grossAmount,
      statusCode,
    })).digest('hex');
    const { data, error } = await service.rpc('apply_midtrans_payment_notification', {
      p_provider_order_id: payment.provider_order_id,
      p_provider_transaction_id: notification.transaction_id ? String(notification.transaction_id) : null,
      p_transaction_status: transactionStatus,
      p_fraud_status: notification.fraud_status ? String(notification.fraud_status) : null,
      p_payment_type: notification.payment_type ? String(notification.payment_type) : null,
      p_status_code: statusCode,
      p_amount: grossAmount,
      p_signature_valid: true,
      p_event_fingerprint: fingerprint,
    });
    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    console.error('Midtrans reconciliation failed', error);
    return { ok: false, status: 500, error: 'Rekonsiliasi pembayaran gagal.' };
  }
}
