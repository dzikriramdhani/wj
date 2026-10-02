import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';

const updateStatusSchema = z.object({
  status: z.enum([
    'SUBMITTED', 'REVIEWED', 'QUOTED', 'NEGOTIATING', 'ACCEPTED', 'REJECTED', 'IN_PRODUCTION', 'COMPLETED',
  ]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: 'Layanan RFQ belum dikonfigurasi.' }, { status: 503 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID RFQ tidak valid.' }, { status: 400 });
  }

  try {
    const input = updateStatusSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sesi pengguna tidak ditemukan.' }, { status: 401 });

    const { data, error } = await supabase.rpc('update_rfq_status', {
      p_rfq_id: id,
      p_next_status: input.status.toLowerCase(),
    });

    if (error) {
      console.error('RFQ status update failed:', error);
      return NextResponse.json(
        { error: error.code === '42501' ? 'Anda tidak memiliki izin mengubah RFQ.' : 'Perubahan status RFQ tidak dapat diterapkan.' },
        { status: error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400 },
      );
    }

    return NextResponse.json({ success: true, status: String(data).toUpperCase() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Status tidak valid.' }, { status: 400 });
    }
    console.error('RFQ status request failed:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui RFQ.' }, { status: 500 });
  }
}
