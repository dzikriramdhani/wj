import { createServiceClient } from '@/lib/supabase/service';
import HomeCmsClient from './HomeCmsClient';

export default async function AdminHomeContentPage() {
  const service = createServiceClient();
  const { data, error } = await service
    .from('products')
    .select('name,slug')
    .eq('is_active', true)
    .order('name')
    .limit(200);

  return (
    <HomeCmsClient
      products={(data ?? []).map((product) => ({ name: product.name, slug: product.slug }))}
      productsError={Boolean(error)}
    />
  );
}
