import 'server-only';

import { unstable_cache } from 'next/cache';
import { defaultHomeContent, homeContentSchema } from '@/lib/home-content';
import { createServiceClient } from '@/lib/supabase/service';

const readCachedHome = unstable_cache(
  async () => {
    const service = createServiceClient();
    const { data, error } = await service
      .from('cms_home_pages')
      .select('published_content')
      .eq('page_key', 'home')
      .maybeSingle();
    if (error) throw error;
    const parsed = homeContentSchema.safeParse(data?.published_content);
    return parsed.success ? parsed.data : defaultHomeContent;
  },
  ['published-home-content-v1'],
  { revalidate: 3600, tags: ['cms-home-published'] },
);

export async function getPublishedHomeContent() {
  try {
    return await readCachedHome();
  } catch (error) {
    console.error('published homepage content unavailable', error);
    return defaultHomeContent;
  }
}
