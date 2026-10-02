import 'server-only';

const baseUrl = 'https://rajaongkir.komerce.id/api/v1';

type RajaResponse = { data?: unknown; meta?: { message?: string } };

export type ShippingDestination = {
  id: string;
  label: string;
  provinceId: string;
  provinceName: string;
  cityName: string;
  districtName: string | null;
  postalCode: string | null;
};

export type ProviderShippingOption = {
  courierCode: string;
  courierName: string;
  serviceCode: string;
  serviceName: string;
  cost: number;
  etd: string | null;
};

function getConfig() {
  const key = process.env.RAJAONGKIR_API_KEY?.trim();
  if (!key) throw new Error('RajaOngkir belum dikonfigurasi.');
  const originSearch = process.env.RAJAONGKIR_ORIGIN_SEARCH?.trim();
  const originId = process.env.RAJAONGKIR_ORIGIN_ID?.trim();
  const courier = process.env.RAJAONGKIR_COURIERS?.trim() || 'jne:pos:tiki';
  const packagingWeight = Number.parseInt(process.env.SHIPPING_PACKAGING_WEIGHT_GRAMS ?? '500', 10);
  if (!originId && !originSearch) throw new Error('Lokasi asal pengiriman belum dikonfigurasi.');
  if (!Number.isInteger(packagingWeight) || packagingWeight < 0) throw new Error('Berat kemasan belum dikonfigurasi dengan benar.');
  return { key, originId: originId || null, originSearch: originSearch || null, courier, packagingWeight };
}

async function providerFetch(path: string, init: RequestInit = {}) {
  const { key } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { key, Accept: 'application/json', ...init.headers },
      cache: 'no-store',
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({})) as RajaResponse;
    if (!response.ok) throw new Error(body.meta?.message || 'RajaOngkir tidak dapat memproses permintaan.');
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function destinationFromProvider(row: Record<string, unknown>): ShippingDestination | null {
  const id = String(row.id ?? row.destination_id ?? row.city_id ?? '');
  if (!id) return null;
  const cityName = String(row.city_name ?? row.city ?? row.label ?? '');
  const district = row.district_name ?? row.district ?? row.subdistrict_name ?? null;
  return {
    id,
    label: String(row.label ?? [cityName, row.province_name].filter(Boolean).join(', ')),
    // The RajaOngkir destination-search response currently exposes a province
    // name but no province ID. The provider destination ID remains the
    // authoritative value for calculating shipping; retain the name here for
    // the address snapshot until a canonical province reference is available.
    provinceId: String(row.province_id ?? row.province_name ?? 'unknown'),
    provinceName: String(row.province_name ?? ''),
    cityName,
    districtName: district ? String(district) : null,
    postalCode: row.zip_code || row.postal_code ? String(row.zip_code ?? row.postal_code) : null,
  };
}

export async function searchRajaDestinations(search: string, limit = 10) {
  const params = new URLSearchParams({ search, limit: String(limit), offset: '0' });
  const result = await providerFetch(`/destination/domestic-destination?${params}`);
  const rows = Array.isArray(result.data) ? result.data : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map(destinationFromProvider)
    .filter((destination): destination is ShippingDestination => Boolean(destination));
}

async function resolveOriginId() {
  const config = getConfig();
  if (config.originId) return config.originId;
  const matches = await searchRajaDestinations(config.originSearch!, 10);
  if (!matches[0]) throw new Error('Lokasi asal RajaOngkir tidak ditemukan.');
  return matches[0].id;
}

export async function getShippingOptions(destinationId: string, weightGrams: number) {
  const config = getConfig();
  const origin = await resolveOriginId();
  const form = new URLSearchParams({
    origin,
    destination: destinationId,
    weight: String(weightGrams),
    courier: config.courier,
    price: 'lowest',
  });
  const result = await providerFetch('/calculate/domestic-cost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const rows = Array.isArray(result.data) ? result.data : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row): ProviderShippingOption | null => {
      const cost = Number(row.cost);
      const courierCode = String(row.code ?? row.courier_code ?? '').toLowerCase();
      const serviceCode = String(row.service ?? row.service_code ?? '');
      if (!courierCode || !serviceCode || !Number.isFinite(cost) || cost < 0) return null;
      return {
        courierCode,
        courierName: String(row.name ?? courierCode.toUpperCase()),
        serviceCode,
        serviceName: String(row.description ?? serviceCode),
        cost,
        etd: row.etd ? String(row.etd) : null,
      };
    })
    .filter((option): option is ProviderShippingOption => Boolean(option));
}

export function getPackagingWeightGrams() {
  return getConfig().packagingWeight;
}
