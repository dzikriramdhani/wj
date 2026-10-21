import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';
import { getHomeAssetUrl } from '@/lib/home-content';
import { getPublishedHomeContent } from '@/lib/home-content-server';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublishedHomeContent();
  const image = content.about.imagePath ? getHomeAssetUrl(content.about.imagePath) : undefined;
  return {
    title: content.seo.title,
    description: content.seo.description,
    openGraph: {
      title: content.seo.title,
      description: content.seo.description,
      type: 'website',
      locale: 'id_ID',
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function HomePage() {
  const content = await getPublishedHomeContent();
  return <HomePageClient initialContent={content} />;
}
