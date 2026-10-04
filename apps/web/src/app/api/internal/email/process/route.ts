import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { reportServerError } from '@/lib/observability';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

type EmailJob = { id: string; recipient_email: string; template_key: string; payload: Record<string, unknown> };

function renderEmail(job: EmailJob) {
  const payload = job.payload;
  if (job.template_key === 'contact.message_received') {
    const name = String(payload.name ?? 'Pengunjung');
    const email = String(payload.email ?? '');
    const subject = String(payload.subject ?? 'Pesan baru');
    const message = String(payload.message ?? '');
    return {
      subject: `[WINAJAYA] Pesan kontak: ${subject}`,
      text: `Pesan baru dari ${name} <${email}>\n\n${message}`,
    };
  }
  if (job.template_key === 'rfq.submitted') {
    return {
      subject: 'RFQ WINAJAYA telah diterima',
      text: `RFQ Anda telah diterima dengan referensi ${String(payload.rfq_id ?? '')}. Tim kami akan meninjaunya.`,
    };
  }
  if (job.template_key === 'order.paid' || job.template_key === 'payment_settled') {
    return {
      subject: 'Pembayaran WINAJAYA diterima',
      text: `Pembayaran untuk pesanan ${String(payload.order_number ?? '')} telah diterima.`,
    };
  }
  return {
    subject: 'Pembaruan dari WINAJAYA',
    text: 'Ada pembaruan pada akun atau pesanan Anda.',
  };
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM?.trim();
  if (!host || !user || !password || !from) {
    return NextResponse.json({ error: 'SMTP belum dikonfigurasi.' }, { status: 503 });
  }

  const port = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return NextResponse.json({ error: 'Port SMTP tidak valid.' }, { status: 503 });
  }

  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc('claim_email_outbox', { p_limit: 20 });
    if (error) throw error;
    const jobs = (data ?? []) as EmailJob[];
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
    let sent = 0;
    for (const job of jobs) {
      try {
        const rendered = renderEmail(job);
        await transport.sendMail({ from, to: job.recipient_email, subject: rendered.subject, text: rendered.text });
        const { error: completeError } = await service.rpc('complete_email_outbox', { p_id: job.id, p_sent: true, p_error: null });
        if (completeError) throw completeError;
        sent += 1;
      } catch (jobError) {
        const message = jobError instanceof Error ? jobError.message : 'delivery failed';
        const { error: completeError } = await service.rpc('complete_email_outbox', { p_id: job.id, p_sent: false, p_error: message });
        if (completeError) console.error('email retry state failed', completeError);
      }
    }
    return NextResponse.json({ success: true, claimed: jobs.length, sent });
  } catch (error) {
    reportServerError(error, 'email.process');
    return NextResponse.json({ error: 'Email belum dapat diproses.' }, { status: 500 });
  }
}

export { POST as GET };
