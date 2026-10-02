import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { toPublicProduct } from '@/lib/supabase/catalog';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: 'Katalog database belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const { slug } = await params;
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,name,slug,sku,composition,gsm,width_cm,description,certifications,moq_retail,is_custom_only,
        categories!inner(name),product_variants(id,color_name,color_hex),product_images(storage_path,position),
        product_prices(price_per_meter,min_quantity)
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .eq('categories.is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });

    const { data: availabilityRows } = await supabase.rpc('get_catalog_availability', {
      p_product_ids: [data.id],
    });
    const isAvailable = (availabilityRows as Array<{ is_available: boolean }> | null | undefined)
      ?.some((row) => row.is_available) ?? false;

    return NextResponse.json(
      { product: toPublicProduct(data as never, isAvailable) },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('Supabase product query failed:', error);
    return NextResponse.json({ error: 'Produk belum dapat dimuat.' }, { status: 500 });
  }
}
