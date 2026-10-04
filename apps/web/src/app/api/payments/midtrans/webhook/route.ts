import { createHash, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { reportServerError } from '@/lib/observability';

export const runtime = 'nodejs';

const notificationSchema = z.object({
  order_id: z.string().min(1).max(100),
  status_code: z.string().min(1).max(10),
  gross_amount: z.union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().nonnegative()]),
  signature_key: z.string().length(128),
  transaction_status: z.string().min(1).max(40),
  fraud_status: z.string().max(40).optional(),
  payment_type: z.string().max(60).optional(),
  transaction_id: z.string().max(120).optional(),
}).passthrough();

function signatureMatches(input: z.infer<typeof notificationSchema>) {
  const key = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!key) return false;
  const amount = String(input.gross_amount);
  const expected = createHash('sha512').update(`${input.order_id}${input.status_code}${amount}${key}`).digest('hex');
  const received = input.signature_key.toLowerCase();
  return expected.length === received.length && timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  let input: z.infer<typeof notificationSchema>;
  try {
    input = notificationSchema.parse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: 'Format notification tidak valid.' }, { status: 400 });
  }

  const signatureValid = signatureMatches(input);
  const eventFingerprint = createHash('sha256').update(JSON.stringify({
    orderId: input.order_id,
    transactionId: input.transaction_id ?? '',
    transactionStatus: input.transaction_status,
    statusCode: input.status_code,
    grossAmount: String(input.gross_amount),
    signature: input.signature_key,
  })).digest('hex');
  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc('apply_midtrans_payment_notification', {
      p_provider_order_id: input.order_id,
      p_provider_transaction_id: input.transaction_id ?? null,
      p_transaction_status: input.transaction_status,
      p_fraud_status: input.fraud_status ?? null,
      p_payment_type: input.payment_type ?? null,
      p_status_code: input.status_code,
      p_amount: Number(input.gross_amount),
      p_signature_valid: signatureValid,
      p_event_fingerprint: eventFingerprint,
    });
    if (error) throw error;
    if (!signatureValid) return NextResponse.json({ error: 'Signature tidak valid.' }, { status: 401 });
    if (!data?.accepted) return NextResponse.json({ error: 'Notification tidak dapat diterapkan.' }, { status: 422 });
    return NextResponse.json({ received: true });
  } catch (error) {
    reportServerError(error, 'payments.midtrans.webhook');
    return NextResponse.json({ error: 'Webhook belum dapat diproses.' }, { status: 500 });
  }
}
