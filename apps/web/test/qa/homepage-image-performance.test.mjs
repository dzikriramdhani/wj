import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => readFile(path.join(appRoot, file), 'utf8');

test('homepage remains CMS-driven and renders responsive CMS backgrounds through next/image', async () => {
  const [page, homeClient, styles, serverContent] = await Promise.all([
    read('src/app/page.tsx'),
    read('src/app/HomePageClient.tsx'),
    read('src/app/page.module.css'),
    read('src/lib/home-content-server.ts'),
  ]);

  assert.match(page, /getPublishedHomeContent/);
  assert.match(page, /<HomePageClient initialContent=\{content\}/);
  assert.match(serverContent, /unstable_cache/);
  assert.match(serverContent, /published_content/);
  assert.match(homeClient, /getHomeAssetUrl\(homeContent\.hero\.imagePath\)/);
  assert.match(homeClient, /getHomeAssetUrl\(homeContent\.about\.imagePath\)/);
  assert.match(homeClient, /fallbackSrc="\/cover\.jpg"[\s\S]*?sizes="100vw"[\s\S]*?preload/);
  assert.match(homeClient, /fallbackSrc="\/home\.jpg"[\s\S]*?sizes=/);
  assert.match(homeClient, /failedSource === src/);
  assert.match(styles, /\.heroBgImage\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /\.aboutImage\s*\{[^}]*object-fit:\s*cover/s);
});

test('homepage catalog scroll updates at most once per frame without React state renders', async () => {
  const homeClient = await read('src/app/HomePageClient.tsx');
  const styles = await read('src/app/page.module.css');

  assert.match(homeClient, /requestAnimationFrame\(/);
  assert.match(homeClient, /translate3d\(-\$\{progress \* maxScrollRef\.current\}px/);
  assert.match(homeClient, /addEventListener\('scroll', updatePosition, \{ passive: true \}\)/);
  assert.match(homeClient, /cancelAnimationFrame\(frame\)/);
  assert.doesNotMatch(homeClient, /setScrollProgress|setMaxScroll/);
  assert.doesNotMatch(homeClient, /observer\.observe\(document\.body\)/);
  assert.doesNotMatch(styles.match(/\.productGrid\s*\{[^}]*\}/s)?.[0] ?? '', /transition:\s*transform/);
});

test('homepage requests only selected CMS products or the first eight and preserves general catalog queries', async () => {
  const homeClient = await read('src/app/HomePageClient.tsx');
  const productsRoute = await read('src/app/api/products/route.ts');

  assert.match(homeClient, /\/api\/products\?home=1/);
  assert.match(homeClient, /initialContent\.catalog\.productSlugs\.join\(','\)/);
  assert.match(homeClient, /initialContent\.catalog\.productSlugs\.flatMap/);
  assert.match(productsRoute, /const homepageRequest = params\.get\('home'\) === '1'/);
  assert.match(productsRoute, /productQuery = productQuery\.in\('slug', homepageSlugs\)/);
  assert.match(productsRoute, /productQuery\.limit\(homepageRequest \? 8 : 1000\)/);
  assert.match(productsRoute, /homepageSlugs\.length > 8/);
  assert.match(productsRoute, /Promise\.resolve\(\{ data: \[\], error: null \}\)/);
});

test('cart and checkout product thumbnails use next/image while generated payment QR stays direct', async () => {
  const [cart, checkout] = await Promise.all([
    read('src/app/cart/page.tsx'),
    read('src/app/checkout/page.tsx'),
  ]);

  assert.match(cart, /import Image from 'next\/image'/);
  assert.match(cart, /<Image src=\{item\.imageUrl\}[^>]+width=\{96\}[^>]+height=\{96\}/);
  assert.match(checkout, /import Image from 'next\/image'/);
  assert.match(checkout, /<Image src=\{item\.imageUrl\}[^>]+width=\{64\}[^>]+height=\{64\}/);
  assert.match(checkout, /<img src=\{`\/api\/orders\/\$\{encodeURIComponent\(orderId\)\}\/payment-qr`\}/);
});
