import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const allowed: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
export async function POST(request: Request) {
  const form = await request.formData(); const organizationId = String(form.get('organizationId') ?? ''); const files = form.getAll('files').filter((value): value is File => value instanceof File);
  if (!z.string().uuid().safeParse(organizationId).success || !files.length || files.length > 10 || files.some((file) => !allowed[file.type] || !file.size || file.size > 20 * 1024 * 1024)) return NextResponse.json({ error: 'Unggah 1–10 PDF/JPG/PNG maksimal 20 MB.' }, { status: 400 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
  const { data: membership } = await supabase.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) return NextResponse.json({ error: 'Hanya owner atau admin perusahaan yang dapat mengunggah dokumen.' }, { status: 403 });
  try { const service = createServiceClient(); const documents = [] as Array<{ name: string; path: string }>;
    for (const file of files) { const path = `${organizationId}/${randomUUID()}.${allowed[file.type]}`; const { error } = await service.storage.from('business-documents').upload(path, file, { contentType: file.type, upsert: false }); if (error) throw error; documents.push({ name: file.name, path }); }
    return NextResponse.json({ documents }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Dokumen belum dapat diunggah.' }, { status: 503 }); }
}
