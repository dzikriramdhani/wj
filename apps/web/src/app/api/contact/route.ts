import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5_000),
}).strict();

export async function POST(request: Request) {
  const rate = checkRateLimit(request, 'contact', 5, 10 * 60_000);
  if (!rate.allowed) return NextResponse.json(
    { error: 'Terlalu banyak pesan. Coba kembali beberapa menit lagi.' },
    { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
  );
  const parsed = contactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data pesan tidak valid.' }, { status: 400 });

  try {
    const service = createServiceClient();
    const { data: contact, error } = await service
      .from('contact_messages')
      .insert(parsed.data)
      .select('id')
      .single();
    if (error || !contact) throw error ?? new Error('contact insert failed');

    const adminEmail = process.env.EMAIL_ADMIN?.trim();
    if (adminEmail) {
      const { error: emailError } = await service.from('email_outbox').insert({
        dedupe_key: `contact:${contact.id}`,
        recipient_email: adminEmail,
        template_key: 'contact.message_received',
        payload: { contactId: contact.id, ...parsed.data },
      });
      if (emailError) console.error('contact email enqueue failed', emailError);
    }
    return NextResponse.json({ success: true, message: 'Pesan Anda sudah diterima.' }, { status: 201 });
  } catch (error) {
    console.error('contact message failed', error);
    return NextResponse.json({ error: 'Pesan belum dapat dikirim. Coba kembali sebentar lagi.' }, { status: 503 });
  }
}
