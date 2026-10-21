import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdminUser } from '@/lib/super-admin-auth';
import { defaultHomeContent, homeContentSchema } from '@/lib/home-content';
import { createServiceClient } from '@/lib/supabase/service';

async function canManageHome(service: ReturnType<typeof createServiceClient>, actorId: string) {
  const { data, error } = await service.rpc('actor_can_manage_home_cms', { p_actor_user_id: actorId });
  if (error) throw error;
  return data === true;
}

export async function GET() {
  const editor = await requireSuperAdminUser();
  if (!editor) return NextResponse.json({ error: 'Akses Super Admin diperlukan.' }, { status: 403 });

  try {
    const service = createServiceClient();
    if (!await canManageHome(service, editor.id)) return NextResponse.json({ error: 'Izin mengelola konten beranda diperlukan.' }, { status: 403 });
    const [{ data: page, error: pageError }, { data: revisions, error: revisionsError }] = await Promise.all([
      service.from('cms_home_pages').select('draft_content,published_content,draft_revision,published_revision,published_at').eq('page_key', 'home').maybeSingle(),
      service.from('cms_home_revisions').select('revision,saved_by,saved_at').eq('page_key', 'home').order('revision', { ascending: false }).limit(20),
    ]);
    if (pageError) throw pageError;
    if (revisionsError) throw revisionsError;
    if (!page) return NextResponse.json({ error: 'Konten awal belum tersedia. Pastikan migrasi CMS Beranda sudah diterapkan.' }, { status: 503 });

    const draft = homeContentSchema.safeParse(page.draft_content);
    const published = homeContentSchema.safeParse(page.published_content);
    return NextResponse.json({
      draft: draft.success ? draft.data : defaultHomeContent,
      published: published.success ? published.data : defaultHomeContent,
      draftRevision: page.draft_revision,
      publishedRevision: page.published_revision,
      publishedAt: page.published_at,
      revisions: revisions ?? [],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('admin homepage content read failed', error);
    return NextResponse.json({ error: 'Konten beranda belum dapat dimuat. Periksa migrasi CMS dan konfigurasi Supabase.' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const editor = await requireSuperAdminUser();
  if (!editor) return NextResponse.json({ error: 'Akses Super Admin diperlukan.' }, { status: 403 });
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 300_000) return NextResponse.json({ error: 'Ukuran konten terlalu besar.' }, { status: 413 });

  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Format konten tidak valid.' }, { status: 400 }); }
  const parsed = homeContentSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Periksa kembali isi konten beranda.', details: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    if (!await canManageHome(service, editor.id)) return NextResponse.json({ error: 'Izin mengelola konten beranda diperlukan.' }, { status: 403 });
    const { data, error } = await service.rpc('save_home_cms_draft', { p_actor_user_id: editor.id, p_content: parsed.data });
    if (error) throw error;
    return NextResponse.json({ success: true, revision: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('admin homepage draft save failed', error);
    return NextResponse.json({ error: 'Draft belum dapat disimpan. Pastikan migrasi CMS Beranda sudah diterapkan.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const editor = await requireSuperAdminUser();
  if (!editor) return NextResponse.json({ error: 'Akses Super Admin diperlukan.' }, { status: 403 });

  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 }); }
  if (!input || typeof input !== 'object' || !('action' in input)) return NextResponse.json({ error: 'Aksi tidak valid.' }, { status: 400 });
  const action = (input as { action?: unknown }).action;

  try {
    const service = createServiceClient();
    if (!await canManageHome(service, editor.id)) return NextResponse.json({ error: 'Izin mengelola konten beranda diperlukan.' }, { status: 403 });

    if (action === 'restore') {
      const revision = (input as { revision?: unknown }).revision;
      if (!Number.isSafeInteger(revision) || Number(revision) < 0) return NextResponse.json({ error: 'Versi revisi tidak valid.' }, { status: 400 });
      const { data: savedRevision, error: revisionError } = await service.from('cms_home_revisions').select('content').eq('page_key', 'home').eq('revision', Number(revision)).maybeSingle();
      if (revisionError) throw revisionError;
      const parsed = homeContentSchema.safeParse(savedRevision?.content);
      if (!parsed.success) return NextResponse.json({ error: 'Versi konten tersebut tidak dapat dipulihkan.' }, { status: 404 });
      const { data, error } = await service.rpc('save_home_cms_draft', { p_actor_user_id: editor.id, p_content: parsed.data });
      if (error) throw error;
      return NextResponse.json({ success: true, revision: data, restoredFrom: Number(revision) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (action !== 'publish') return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
    const { data, error } = await service.rpc('publish_home_cms_draft', { p_actor_user_id: editor.id });
    if (error) throw error;
    revalidateTag('cms-home-published', { expire: 0 });
    revalidatePath('/');
    return NextResponse.json({ success: true, revision: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error(`admin homepage ${action === 'publish' ? 'publish' : 'revision restore'} failed`, error);
    return NextResponse.json({ error: 'Perubahan belum dapat diterapkan. Pastikan migrasi CMS Beranda sudah diterapkan.' }, { status: 503 });
  }
}
