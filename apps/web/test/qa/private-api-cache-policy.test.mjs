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
