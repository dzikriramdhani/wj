import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { toPublicProduct } from '@/lib/supabase/catalog';

const catalogSelect = `
  id,name,slug,sku,composition,gsm,width_cm,description,certifications,moq_retail,is_custom_only,
  categories!inner(name),
  product_variants(id,color_name,color_hex),
  product_images(storage_path,position),
  product_prices(price_per_meter,min_quantity)
`;

export async function GET(request: NextRequest) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json(
      { error: 'Katalog database belum dikonfigurasi.' },
      { status: 503 },
    );
  }

  try {
    const params = request.nextUrl.searchParams;
    const homepageRequest = params.get('home') === '1';
    const page = homepageRequest ? 1 : Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
    const limit = homepageRequest ? 8 : Math.min(50, Math.max(1, Number.parseInt(params.get('limit') ?? '12', 10) || 12));
    const rawSlugs = homepageRequest ? params.get('slugs') : null;
    const homepageSlugs = rawSlugs ? rawSlugs.split(',') : [];
    if (homepageSlugs.length > 8
      || homepageSlugs.some((slug) => slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      || new Set(homepageSlugs).size !== homepageSlugs.length) {
      return NextResponse.json({ error: 'Pilihan produk beranda tidak valid.' }, { status: 400 });
    }

    const supabase = createPublicClient();
    let productQuery = supabase
      .from('products')
      .select(catalogSelect)
      .eq('is_active', true)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .eq('categories.is_active', true)
      .order('name');
    if (homepageSlugs.length) productQuery = productQuery.in('slug', homepageSlugs);
    const [{ data, error }, { data: categoryRows, error: categoryError }] = await Promise.all([
      productQuery.limit(homepageRequest ? 8 : 1000),
      homepageRequest
        ? Promise.resolve({ data: [], error: null })
        : supabase.from('categories').select('id,name,slug').eq('is_active', true).order('position').order('name'),
    ]);

    if (error) throw error;
    if (categoryError) throw categoryError;

    const catalogRows = data ?? [];
    const { data: availabilityRows } = catalogRows.length
      ? await supabase.rpc('get_catalog_availability', { p_product_ids: catalogRows.map((row) => row.id) })
      : { data: [] };
    const availability = new Set(
      ((availabilityRows ?? []) as Array<{ is_available: boolean; product_id: string }>)
        .filter((row) => row.is_available)
        .map((row) => row.product_id),
    );
    let products = catalogRows.map((row) => toPublicProduct(row as never, availability.has(row.id)));
    const category = params.get('category')?.toLocaleLowerCase('id-ID');
    const search = params.get('search')?.toLocaleLowerCase('id-ID');
    const minPrice = Number(params.get('minPrice'));
    const maxPrice = Number(params.get('maxPrice'));
    const minGsm = Number(params.get('minGsm'));
    const maxGsm = Number(params.get('maxGsm'));

    if (category) products = products.filter((product) => product.category.toLocaleLowerCase('id-ID') === category);
    if (search) products = products.filter((product) =>
      [product.name, product.category, product.composition, product.description]
        .some((value) => value.toLocaleLowerCase('id-ID').includes(search)),
    );
    if (params.has('minPrice') && Number.isFinite(minPrice)) products = products.filter((product) => product.pricePerMeter >= minPrice);
    if (params.has('maxPrice') && Number.isFinite(maxPrice)) products = products.filter((product) => product.pricePerMeter <= maxPrice);
    if (params.has('minGsm') && Number.isFinite(minGsm)) products = products.filter((product) => product.gsm >= minGsm);
    if (params.has('maxGsm') && Number.isFinite(maxGsm)) products = products.filter((product) => product.gsm <= maxGsm);

    const total = products.length;
    products = products.slice((page - 1) * limit, page * limit);

    return NextResponse.json(
      {
        products,
        categories: (categoryRows ?? []).map((item) => ({ id: item.id, name: item.name, slug: item.slug })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('Supabase catalog query failed:', error);
    return NextResponse.json({ error: 'Katalog belum dapat dimuat.' }, { status: 500 });
  }
}
