import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // The storefront includes remote review avatars. Keep browser runs offline
  // from third-party image hosts; image delivery has a separate test target.
  await page.route('**/_next/image**', (route) => route.abort());
});

test('public homepage and catalog render without a server error', async ({ page }) => {
  const home = await page.goto('/');
  expect(home?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const catalog = await page.goto('/products');
  expect(catalog?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Semua produk' })).toBeVisible();
});

for (const route of ['/admin', '/super-admin']) {
  test(`anonymous direct navigation to ${route} redirects to login`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/login');
  });
}
