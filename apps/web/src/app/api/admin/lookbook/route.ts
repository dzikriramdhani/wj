import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

const extensionByType: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

export async function POST(request: Request) {
  const editor = await requireAdminUser();
  if (!editor) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403 });
  const files = (await request.formData()).getAll('files').filter((value): value is File => value instanceof File);
  if (!files.length || files.length > 12 || files.some((file) => !extensionByType[file.type] || file.size <= 0 || file.size > 20 * 1024 * 1024)) {
    return NextResponse.json({ error: 'Unggah 1–12 gambar JPG, PNG, WebP, atau AVIF dengan ukuran maksimal 20 MB.' }, { status: 400 });
  }
  try {
    const service = createServiceClient();
    const paths: string[] = [];
    for (const file of files) {
      // Keep lookbook assets at the bucket root so the public gallery can list
      // them without exposing or traversing an implementation-specific folder.
      const path = `${randomUUID()}.${extensionByType[file.type]}`;
      const { error } = await service.storage.from('lookbook-images').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      paths.push(path);
    }
    await service.from('audit_logs').insert({ actor_user_id: editor.id, action: 'lookbook.images_added', entity_type: 'lookbook', metadata: { count: paths.length } });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('lookbook upload failed', error);
    return NextResponse.json({ error: 'Gambar lookbook belum dapat diunggah.' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const editor = await requireAdminUser();
  if (!editor) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403 });
  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!/^[0-9a-f-]+\.(jpg|png|webp|avif)$/.test(path)) return NextResponse.json({ error: 'Path gambar tidak valid.' }, { status: 400 });
  try {
    const service = createServiceClient();
    const { error } = await service.storage.from('lookbook-images').remove([path]);
    if (error) throw error;
    await service.from('audit_logs').insert({ actor_user_id: editor.id, action: 'lookbook.image_removed', entity_type: 'lookbook', metadata: { path } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('lookbook deletion failed', error);
    return NextResponse.json({ error: 'Gambar lookbook belum dapat dihapus.' }, { status: 503 });
  }
}
