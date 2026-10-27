import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const privateRoutes = [
  'src/app/api/account/profile/route.ts',
  'src/app/api/admin/search/route.ts',
  'src/app/api/super-admin/content/home/route.ts',
  'src/app/api/orders/[id]/route.ts',
];
const compatibilityRoutes = [
  'src/app/api/auth/reset-password/route.ts',
  'src/app/api/warehouse/orders/[id]/fulfillment/route.ts',
  'src/app/api/admin/lookbook/route.ts',
  'src/app/api/finance/payments/reconcile/route.ts',
  'src/app/api/quotations/[id]/route.ts',
  'src/app/api/business/verification/route.ts',
  'src/app/api/admin/business-prices/route.ts',
  'src/app/api/quotations/route.ts',
  'src/app/api/super-admin/users/[id]/roles/route.ts',
  'src/app/api/admin/governance/data-requests/[id]/route.ts',
  'src/app/api/admin/products/route.ts',
  'src/app/api/admin/products/[id]/variants/route.ts',
  'src/app/api/business/organizations/route.ts',
  'src/app/api/admin/payments/reconcile/route.ts',
  'src/app/api/business/organizations/[id]/members/route.ts',
  'src/app/api/privacy/requests/route.ts',
  'src/app/api/rfq/route.ts',
  'src/app/api/rfq/[id]/route.ts',
  'src/app/api/rfq/[id]/attachments/route.ts',
  'src/app/api/business/verification/documents/route.ts',
  'src/app/api/admin/products/[id]/images/route.ts',
  'src/app/api/admin/orders/[id]/fulfillment/route.ts',
];

test('private JSON helper overrides caller cache directives with no-store', async () => {
  const helper = await readFile(path.join(appRoot, 'src/lib/api-response.ts'), 'utf8');

  assert.match(helper, /headers\.set\('Cache-Control', 'private, no-store'\)/);
  assert.match(helper, /return NextResponse\.json\(body, \{ \.\.\.init, headers \}\)/);
});

for (const route of privateRoutes) {
  test(`${route} sends JSON through the private cache helper`, async () => {
    const source = await readFile(path.join(appRoot, route), 'utf8');

    assert.match(source, /import \{ privateJson \} from '@\/lib\/api-response';/);
    assert.match(source, /return privateJson\(/);
    assert.doesNotMatch(source, /NextResponse\.json\(/);
  });
}

for (const route of compatibilityRoutes) {
  test(`${route} aliases the private JSON compatibility helper`, async () => {
    const source = await readFile(path.join(appRoot, route), 'utf8');

    assert.match(source, /import \{ privateJsonResponse as NextResponse \} from '@\/lib\/api-response';/);
    assert.match(source, /NextResponse\.json\(/);
    assert.doesNotMatch(source, /from 'next\/server';[^\n]*NextResponse/);
  });
}
