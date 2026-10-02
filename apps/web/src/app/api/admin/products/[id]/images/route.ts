import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const extensionByType: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
};

async function productIdFrom(params: Promise<{ id: string }>) {
  const { id } = await params;
  return z.uuid().safeParse(id).success ? id : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const editor = await requireAdminUser();
  if (!editor) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403 });
  const productId = await productIdFrom(params);
  if (!productId) return NextResponse.json({ error: 'ID produk tidak valid.' }, { status: 400 });
  const form = await request.formData();
  const files = form.getAll('files').filter((value): value is File => value instanceof File);
  if (!files.length || files.length > 6) return NextResponse.json({ error: 'Unggah 1 sampai 6 gambar.' }, { status: 400 });
  if (files.some((file) => !allowedTypes.has(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024)) {
    return NextResponse.json({ error: 'Gambar harus JPG, PNG, WebP, atau AVIF dengan ukuran maksimal 10 MB.' }, { status: 400 });
  }
  try {
    const service = createServiceClient();
    const { data: product, error: productError } = await service.from('products').select('id').eq('id', productId).maybeSingle();
    if (productError || !product) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    const { data: latest } = await service.from('product_images').select('position').eq('product_id', productId).order('position', { ascending: false }).limit(1);
    let position = Number(latest?.[0]?.position ?? -1) + 1;
    const rows: Array<{ product_id: string; storage_path: string; alt_text: string; position: number; is_primary: boolean }> = [];
    for (const file of files) {
      const path = `${productId}/${randomUUID()}.${extensionByType[file.type]}`;
      const { error } = await service.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      rows.push({ product_id: productId, storage_path: path, alt_text: file.name.slice(0, 200), position: position++, is_primary: rows.length === 0 && !latest?.length });
    }
    const { error: insertError } = await service.from('product_images').insert(rows);
    if (insertError) throw insertError;
    await service.from('audit_logs').insert({ actor_user_id: editor.id, action: 'catalog.images_added', entity_type: 'product', entity_id: productId, metadata: { count: rows.length } });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('product image upload failed', error);
    return NextResponse.json({ error: 'Gambar belum dapat diunggah.' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const editor = await requireAdminUser();
  if (!editor) return NextResponse.json({ error: 'Akses Admin diperlukan.' }, { status: 403 });
  const productId = await productIdFrom(params);
  const imageId = request.nextUrl.searchParams.get('imageId');
  if (!productId || !z.uuid().safeParse(imageId).success) return NextResponse.json({ error: 'Data gambar tidak valid.' }, { status: 400 });
  try {
    const service = createServiceClient();
    const { data: image, error } = await service.from('product_images').select('id,storage_path').eq('id', imageId!).eq('product_id', productId).maybeSingle();
    if (error || !image) return NextResponse.json({ error: 'Gambar tidak ditemukan.' }, { status: 404 });
    const { error: deleteError } = await service.from('product_images').delete().eq('id', image.id);
    if (deleteError) throw deleteError;
    const { error: storageError } = await service.storage.from('product-images').remove([image.storage_path]);
    if (storageError) console.error('product image storage deletion failed', storageError);
    await service.from('audit_logs').insert({ actor_user_id: editor.id, action: 'catalog.image_removed', entity_type: 'product', entity_id: productId, metadata: { image_id: image.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('product image removal failed', error);
    return NextResponse.json({ error: 'Gambar belum dapat dihapus.' }, { status: 503 });
  }
}
