import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attachGuestSession, getCommerceOwner } from '@/lib/commerce-owner';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const methodSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bank_transfer'), bank: z.enum(['bca', 'bni', 'bri', 'permata']) }).strict(),
  z.object({ type: z.literal('qris') }).strict(),
  z.object({ type: z.literal('ewallet'), provider: z.enum(['gopay', 'shopeepay', 'dana', 'ovo']) }).strict(),
  z.object({ type: z.literal('cstore'), store: z.enum(['indomaret', 'alfamart']) }).strict(),
]);

const paymentSchema = z.union([
  z.object({ orderId: z.uuid(), method: methodSchema }).strict(),
  z.object({ bulkOrderId: z.uuid(), method: methodSchema }).strict(),
]);

type MidtransAction = { name: string; url: string; method?: string };
type MidtransCharge = {
  status_code?: string;
  transaction_id?: string;
  transaction_status?: string;
  payment_type?: string;
  gross_amount?: string | number;
  expiry_time?: string;
  bank?: string;
  va_numbers?: Array<{ bank?: string; va_number?: string }>;
  permata_va_number?: string;
  qr_string?: string;
  actions?: MidtransAction[];
  store?: string;
  payment_code?: string;
  bill_key?: string;
  biller_code?: string;
  status_message?: string;
};
type PreparedPayment = {
  providerOrderId: string;
  amount: number | string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  expiresAt: string;
};

function midtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) throw new Error('Midtrans belum dikonfigurasi.');
  const production = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  return {
    serverKey,
    apiUrl: production ? 'https://api.midtrans.com/v2/charge' : 'https://api.sandbox.midtrans.com/v2/charge',
  };
}

function buildChargeMethod(method: z.infer<typeof methodSchema>) {
  switch (method.type) {
    case 'bank_transfer':
      return { payment_type: 'bank_transfer', bank_transfer: { bank: method.bank } };
    case 'qris':
      return { payment_type: 'qris' };
    case 'ewallet':
      return { payment_type: method.provider };
    case 'cstore':
      return { payment_type: 'cstore', convenience_store: { store: method.store, message: 'Pembayaran Wina Jaya' } };
  }
}

function formatMidtransJakartaTime(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second} +0700`;
}

function buildCustomExpiry(expiresAt: unknown) {
  const expiry = new Date(typeof expiresAt === 'string' ? expiresAt : '');
  const duration = Math.ceil((expiry.getTime() - Date.now()) / 60_000);
  if (!Number.isFinite(duration) || duration < 1) return undefined;

  return {
    custom_expiry: {
      order_time: formatMidtransJakartaTime(new Date()),
      unit: 'minute',
      expiry_duration: Math.min(duration, 24 * 60),
    },
  };
}

function publicInstruction(response: MidtransCharge) {
  return {
    transactionId: response.transaction_id ?? null,
    transactionStatus: response.transaction_status ?? 'pending',
    paymentType: response.payment_type ?? null,
    grossAmount: Number(response.gross_amount ?? 0),
    expiryTime: response.expiry_time ?? null,
    bank: response.bank ?? response.va_numbers?.[0]?.bank ?? null,
    vaNumbers: response.va_numbers ?? [],
    permataVaNumber: response.permata_va_number ?? null,
    qrString: response.qr_string ?? null,
    actions: (response.actions ?? []).filter((action) => typeof action.url === 'string' && /^https:\/\//i.test(action.url)),
    store: response.store ?? null,
    paymentCode: response.payment_code ?? null,
    billKey: response.bill_key ?? null,
    billerCode: response.biller_code ?? null,
  };
}

function responseFromStored(payment: { payment_url?: string | null; payment_type?: string | null; provider_data?: Record<string, unknown> | null }) {
  const instruction = payment.provider_data;
  if (instruction && typeof instruction.transactionId === 'string') {
    return { success: true, data: { instruction, reused: true } };
  }
  if (payment.payment_url) {
    return { error: 'Pesanan ini sudah memakai sesi pembayaran sebelumnya. Gunakan tautan pembayaran pada status pesanan atau buat pesanan baru untuk memilih metode lain.' };
  }
  return null;
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, 'payment-session', 10, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak percobaan pembayaran. Coba kembali beberapa menit lagi.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });

  try {
    const parsed = paymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Pilih metode pembayaran yang valid.' }, { status: 400 });

    const owner = await getCommerceOwner();
    const service = createServiceClient();
    const isBulkOrder = 'bulkOrderId' in parsed.data;
    let payment: PreparedPayment | null = null;
    let paymentError: { code: string; message: string } | null = null;
    if ('bulkOrderId' in parsed.data) {
      if (!owner.userId) {
        return NextResponse.json({ error: 'Masuk ke akun perusahaan untuk membayar pesanan B2B.' }, { status: 401 });
      }
      const result = await service.rpc('prepare_midtrans_bulk_order_payment', {
        p_bulk_order_id: parsed.data.bulkOrderId,
        p_user_id: owner.userId,
      });
      payment = result.data as PreparedPayment | null;
      paymentError = result.error;
    } else {
      const result = await service.rpc('prepare_midtrans_payment', {
        p_order_id: parsed.data.orderId,
        p_user_id: owner.userId,
        p_guest_session_id: owner.guestSessionId,
      });
      payment = result.data as PreparedPayment | null;
      paymentError = result.error;
    }
    if (paymentError) {
      const missing = paymentError.code === 'P0002';
      if (isBulkOrder) {
        const forbidden = paymentError.code === '42501';
        return NextResponse.json({
          error: missing ? 'Pesanan perusahaan tidak ditemukan.' : forbidden ? 'Anda tidak memiliki akses untuk membayar pesanan ini.' : 'Pesanan perusahaan belum dapat dibayar. Periksa status quotation dan jumlah pembayaran.',
        }, { status: missing ? 404 : forbidden ? 403 : 422 });
      }
      return NextResponse.json({ error: missing ? 'Pesanan tidak ditemukan.' : paymentError.message }, { status: missing ? 404 : 422 });
    }
    if (!payment) return NextResponse.json({ error: 'Sesi pembayaran belum dapat dibuat.' }, { status: 500 });

    const { data: currentPayment, error: lookupError } = isBulkOrder
      ? await service.from('bulk_order_payments')
        .select('payment_type, provider_data')
        .eq('provider', 'midtrans')
        .eq('provider_order_id', String(payment.providerOrderId))
        .maybeSingle()
      : await service.from('payments')
        .select('payment_url, payment_type, provider_data')
        .eq('provider', 'midtrans')
        .eq('provider_order_id', String(payment.providerOrderId))
        .maybeSingle();
    if (lookupError) {
      console.error('Midtrans payment instruction lookup failed', lookupError);
      return NextResponse.json({ error: 'Instruksi pembayaran belum dapat dibaca. Terapkan migrasi checkout pembayaran terlebih dahulu.' }, { status: 503 });
    }
    const stored = currentPayment && responseFromStored(currentPayment);
    if (stored) {
      if ('error' in stored) return attachGuestSession(NextResponse.json(stored, { status: 409 }), owner);
      return attachGuestSession(NextResponse.json(stored), owner);
    }

    const config = midtransConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let providerResponse: Response;
    try {
      providerResponse = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: payment.providerOrderId,
            gross_amount: Math.round(Number(payment.amount)),
          },
          customer_details: {
            first_name: payment.customerName,
            email: payment.customerEmail,
            phone: payment.customerPhone || undefined,
          },
          ...buildChargeMethod(parsed.data.method),
          ...buildCustomExpiry(payment.expiresAt),
        }),
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const providerBody = await providerResponse.json().catch(() => ({})) as MidtransCharge;
    if (!providerResponse.ok || !providerBody.transaction_id || !providerBody.payment_type) {
      console.error('Midtrans Core API charge rejected', providerResponse.status, providerBody.status_code);
      return NextResponse.json({ error: 'Metode pembayaran belum tersedia. Periksa konfigurasi metode di Midtrans atau pilih metode lain.' }, { status: 503 });
    }

    const instruction = publicInstruction(providerBody);
    const completionInput = {
      p_provider_order_id: String(payment.providerOrderId),
      p_provider_transaction_id: instruction.transactionId,
      p_payment_type: instruction.paymentType,
      p_provider_response_code: providerBody.status_code ?? String(providerResponse.status),
      p_provider_data: instruction,
    };
    let completed: { providerData?: Record<string, unknown> } | null = null;
    let completionError: { message: string } | null = null;
    if (isBulkOrder) {
      const result = await service.rpc('complete_midtrans_bulk_order_payment', completionInput);
      completed = result.data as { providerData?: Record<string, unknown> } | null;
      completionError = result.error;
    } else {
      const result = await service.rpc('complete_midtrans_core_payment', completionInput);
      completed = result.data as { providerData?: Record<string, unknown> } | null;
      completionError = result.error;
    }
    if (completionError || !completed?.providerData) {
      console.error('Midtrans payment instructions could not be saved', completionError);
      return NextResponse.json({ error: 'Instruksi pembayaran dibuat, tetapi belum tersimpan. Buka status pesanan sebelum mencoba kembali.' }, { status: 503 });
    }

    return attachGuestSession(NextResponse.json({ success: true, data: { instruction: completed.providerData, reused: false } }), owner);
  } catch (error) {
    console.error('Midtrans custom payment creation failed', error);
    return NextResponse.json({ error: 'Sesi pembayaran belum dapat dibuat.' }, { status: 503 });
  }
}
