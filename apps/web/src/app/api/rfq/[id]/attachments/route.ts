import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const extensionByType: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID RFQ tidak valid.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Masuk ke akun terlebih dahulu.' }, { status: 401 });
  const { data: allowedRfq } = await supabase.from('rfqs').select('id').eq('id', id).maybeSingle();
  if (!allowedRfq) return NextResponse.json({ error: 'RFQ tidak ditemukan atau tidak dapat diakses.' }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll('files').filter((value): value is File => value instanceof File);
  if (!files.length || files.length > 5) return NextResponse.json({ error: 'Lampirkan 1 sampai 5 file.' }, { status: 400 });
  if (files.some((file) => !allowedTypes.has(file.type) || file.size <= 0 || file.size > 20 * 1024 * 1024)) {
    return NextResponse.json({ error: 'File harus PDF, JPG, PNG, atau WebP dengan ukuran maksimal 20 MB.' }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { data: rfq, error: rfqError } = await service.from('rfqs').select('attachments').eq('id', id).single();
    if (rfqError || !rfq) throw rfqError ?? new Error('RFQ missing');
    const paths: string[] = [];
    for (const file of files) {
      const path = `${id}/${randomUUID()}.${extensionByType[file.type]}`;
      const { error } = await service.storage.from('rfq-files').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      paths.push(path);
    }
    const attachments = [...((rfq.attachments ?? []) as string[]), ...paths];
    const { error: updateError } = await service.from('rfqs').update({ attachments }).eq('id', id);
    if (updateError) throw updateError;
    await service.from('audit_logs').insert({ actor_user_id: user.id, action: 'rfq.attachments_added', entity_type: 'rfq', entity_id: id, metadata: { count: paths.length } });
    return NextResponse.json({ success: true, attachments: paths }, { status: 201 });
  } catch (error) {
    console.error('RFQ attachment upload failed', error);
    return NextResponse.json({ error: 'Lampiran belum dapat diunggah.' }, { status: 503 });
  }
}
