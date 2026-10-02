import { NextResponse } from 'next/server';
import { z } from 'zod';
import { attachGuestSession, getCommerceOwner } from '@/lib/commerce-owner';
import { getPackagingWeightGrams, getShippingOptions } from '@/lib/rajaongkir';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const quoteSchema = z.object({
  destination: z.object({
    id: z.string().min(1).max(40),
    label: z.string().min(1).max(240),
    provinceId: z.string().min(1).max(40),
    provinceName: z.string().min(1).max(120),
    cityName: z.string().min(1).max(120),
    districtName: z.string().max(120).nullable().optional(),
    postalCode: z.string().regex(/^\d{5}$/).nullable().optional(),
  }),
  items: z.array(z.object({
    productId: z.uuid(),
    qtyMeters: z.number().positive().max(100000),
  })).min(1).max(30),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = quoteSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Data pengiriman tidak valid.' }, { status: 400 });

    const owner = await getCommerceOwner();
    const input = parsed.data;
    const quantities = new Map<string, number>();
    for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.qtyMeters);

    const service = createServiceClient();
    const { data: productRows, error: productError } = await service
      .from('products')
      .select('id,shipping_weight_grams_per_meter')
      .in('id', [...quantities.keys()])
      .eq('is_active', true)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .eq('is_custom_only', false);
    if (productError || productRows?.length !== quantities.size) {
      return NextResponse.json({ error: 'Satu atau lebih produk tidak tersedia untuk checkout.' }, { status: 422 });
    }

    const totalWeight = Math.max(1, Math.ceil(
      getPackagingWeightGrams() + productRows.reduce((sum, product) =>
        sum + Number(product.shipping_weight_grams_per_meter) * (quantities.get(product.id) ?? 0), 0),
    ));
    const options = await getShippingOptions(input.destination.id, totalWeight);
    if (!options.length) return NextResponse.json({ error: 'Belum ada layanan pengiriman untuk alamat ini.' }, { status: 422 });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: quotes, error: quoteError } = await service
      .from('shipping_quotes')
      .insert(options.map((option) => ({
        user_id: owner.userId,
        guest_session_id: owner.guestSessionId,
        provider: 'rajaongkir',
        courier_code: option.courierCode,
        courier_name: option.courierName,
        service_code: option.serviceCode,
        service_name: option.serviceName,
        destination_city_id: input.destination.id,
        total_cost: option.cost,
        provider_reference: option.etd ? `ETD ${option.etd}; ${totalWeight}g` : `${totalWeight}g`,
        expires_at: expiresAt,
      })))
      .select('id,courier_code,courier_name,service_code,service_name,total_cost,provider_reference,expires_at');
    if (quoteError) throw quoteError;

    const response = NextResponse.json({
      data: (quotes ?? []).map((quote) => ({
        id: quote.id,
        courierCode: quote.courier_code,
        courierName: quote.courier_name,
        serviceCode: quote.service_code,
        serviceName: quote.service_name,
        cost: Number(quote.total_cost),
        detail: quote.provider_reference,
        expiresAt: quote.expires_at,
      })),
    }, { status: 201 });
    return attachGuestSession(response, owner);
  } catch (error) {
    console.error('RajaOngkir quote calculation failed', error);
    return NextResponse.json({ error: 'Ongkir belum dapat dihitung. Coba kembali sebentar lagi.' }, { status: 503 });
  }
}
