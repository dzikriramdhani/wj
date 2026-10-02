import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createRFQSchema } from '@/lib/validators';
import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request, 'rfq', 10, 60 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak permintaan RFQ. Coba kembali nanti.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: 'Layanan RFQ belum dikonfigurasi.' }, { status: 503 });
  }

  const requestKey = request.headers.get('Idempotency-Key');
  if (!requestKey) {
    return NextResponse.json({ error: 'Kunci permintaan wajib dikirim.' }, { status: 400 });
  }

  try {
    const rawBody = await request.json();
    const validation = createRFQSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Data tidak valid.', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const input = validation.data;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Masuk ke akun sebelum mengirim permintaan.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name,phone')
      .eq('id', user.id)
      .maybeSingle();

    const { data: rfqId, error } = await supabase.rpc('create_rfq', {
      p_request_key: requestKey,
      p_product_id: input.productId ?? null,
      p_quantity: input.qtyRequested,
      p_specifications: {
        ...input.specDetails,
        nama: profile?.full_name ?? user.user_metadata?.full_name ?? input.specDetails.nama,
        email: user.email ?? input.specDetails.email,
        telepon: profile?.phone ?? user.user_metadata?.phone ?? input.specDetails.telepon,
      },
      p_deadline: input.deadline ?? null,
      p_attachments: input.attachments,
      p_organization_id: input.organizationId ?? null,
    });

    if (error) {
      console.error('Supabase RFQ creation failed:', error);
      return NextResponse.json(
        { error: 'Permintaan belum dapat disimpan. Periksa data lalu coba kembali.' },
        { status: error.code === '42501' ? 403 : 400 },
      );
    }

    return NextResponse.json(
      {
        message: 'Permintaan berhasil diajukan. Tim Wina Jaya akan meninjau detailnya.',
        rfq: { id: rfqId, status: 'SUBMITTED' },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Data tidak valid.' }, { status: 400 });
    }
    console.error('RFQ request failed:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat memproses permintaan.' }, { status: 500 });
  }
}
