import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdminUser } from '@/lib/super-admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { hasExpectedFileSignature } from '@/lib/upload-validation';

const extensionByType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: NextRequest) {
  const editor = await requireSuperAdminUser();
  if (!editor) return NextResponse.json({ error: 'Akses Super Admin diperlukan.' }, { status: 403 });

  try {
    const service = createServiceClient();
    const { data: allowed, error: permissionError } = await service.rpc('actor_can_manage_home_cms', { p_actor_user_id: editor.id });
    if (permissionError) throw permissionError;
    if (allowed !== true) return NextResponse.json({ error: 'Izin mengelola konten beranda diperlukan.' }, { status: 403 });

    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || !extensionByType[file.type] || file.size <= 0 || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Pilih gambar JPG, PNG, atau WebP maksimal 10 MB.' }, { status: 400 });
    }
    const prefix = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!hasExpectedFileSignature(file.type, prefix)) {
      return NextResponse.json({ error: 'Isi file tidak cocok dengan tipe gambar.' }, { status: 400 });
    }

    const path = `home/${randomUUID()}.${extensionByType[file.type]}`;
    const { error: uploadError } = await service.storage.from('brand-assets').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error: auditError } = await service.from('audit_logs').insert({
      actor_user_id: editor.id,
      action: 'content.home.asset_uploaded',
      entity_type: 'cms_page',
      entity_id: 'home',
      metadata: { path, mime_type: file.type, size_bytes: file.size },
    });
    if (auditError) throw auditError;
    return NextResponse.json({ success: true, path }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('admin homepage asset upload failed', error);
    return NextResponse.json({ error: 'Gambar belum dapat diunggah. Pastikan migrasi CMS Beranda sudah diterapkan.' }, { status: 503 });
  }
}
