import LookbookAdminClient from './LookbookAdminClient';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export default async function AdminLookbookPage() {
  const service = createServiceClient();
  const { data } = await service.storage.from('lookbook-images').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const images = (data ?? []).filter((file) => file.name && !file.id?.endsWith('/')).map((file) => ({ path: file.name, url: `${baseUrl}/storage/v1/object/public/lookbook-images/${encodeURIComponent(file.name)}` }));
  return <LookbookAdminClient images={images} />;
}
