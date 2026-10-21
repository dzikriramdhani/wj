import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const categorySchema = z.object({
  categoryId: z.uuid().nullable().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
  position: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
}).strict();

function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function saveCategory(request: Request, update: boolean) {
  const actor = await requireAdminUser();
  if (!actor) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });

  const rate = checkRateLimit(request, 'admin-categories-write', 20, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak perubahan kategori. Coba kembali nanti.' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(rate.retryAfterSeconds) } });

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Data kategori tidak valid.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const input = parsed.data;
  if ((update && !input.categoryId) || (!update && input.categoryId)) {
    return NextResponse.json({ error: 'Permintaan kategori tidak valid.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const slug = slugify(input.name);
  if (slug.length < 2) return NextResponse.json({ error: 'Nama kategori tidak dapat dibuat menjadi slug.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc('admin_save_catalog_category', {
      p_actor_user_id: actor.id,
      p_category_id: input.categoryId ?? null,
      p_name: input.name,
      p_slug: slug,
      p_description: input.description || null,
      p_position: input.position,
      p_is_active: input.isActive,
    });
    if (error) {
      const status = error.code === '23505' ? 409
        : error.code === 'P0002' ? 404
          : error.code === '42501' ? 403
            : error.code === '22023' ? 400
              : error.code === 'PGRST202' || error.code === '42883' ? 503 : 500;
      const message = error.code === '23505' ? 'Nama kategori sudah digunakan.'
        : error.code === 'P0002' ? 'Kategori tidak ditemukan.'
          : error.code === '42501' ? 'Akses Admin diperlukan.'
            : error.code === '22023' ? 'Data kategori tidak valid.'
              : status === 503 ? 'Migrasi pengelolaan kategori belum diterapkan.'
                : 'Kategori belum dapat disimpan.';
      if (status === 500) console.error('admin catalog category save failed', { code: error.code });
      return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ categoryId: data }, { status: update ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('admin catalog category save failed');
    return NextResponse.json({ error: 'Kategori belum dapat disimpan.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  return saveCategory(request, false);
}

export async function PATCH(request: Request) {
  return saveCategory(request, true);
}
