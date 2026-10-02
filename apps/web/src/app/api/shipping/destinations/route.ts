import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchRajaDestinations } from '@/lib/rajaongkir';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search')?.trim() ?? '';
  if (search.length < 3 || search.length > 120) {
    return NextResponse.json({ error: 'Masukkan minimal 3 karakter lokasi.' }, { status: 400 });
  }
  const limit = z.coerce.number().int().min(1).max(20).safeParse(request.nextUrl.searchParams.get('limit') ?? '10');
  try {
    const destinations = await searchRajaDestinations(search, limit.success ? limit.data : 10);
    return NextResponse.json({ data: destinations }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) {
    console.error('RajaOngkir destination search failed', error);
    return NextResponse.json({ error: 'Lokasi pengiriman belum dapat dicari. Coba kembali sebentar lagi.' }, { status: 503 });
  }
}
