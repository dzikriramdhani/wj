import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workerRoutes = [
  'src/app/api/internal/commerce/expire-reservations/route.ts',
  'src/app/api/internal/operations/process/route.ts',
  'src/app/api/internal/email/process/route.ts',
];

const workerWorkflows = [
  ['.github/workflows/production-workers.yml', 2],
  ['.github/workflows/production-email-outbox.yml', 1],
  ['.github/workflows/staging-workers.yml', 2],
];

for (const route of workerRoutes) {
  test(`${route} is POST-only and never cacheable`, async () => {
    const source = await readFile(path.join(appRoot, route), 'utf8');

    assert.match(source, /export async function POST\(/);
    assert.match(source, /privateJsonResponse as NextResponse/);
    assert.doesNotMatch(source, /export\s*\{\s*POST\s+as\s+GET\s*\}/);
  });
}

for (const [workflow, expectedPostCalls] of workerWorkflows) {
  test(`${workflow} invokes mutating workers with POST`, async () => {
    const source = await readFile(path.resolve(appRoot, '../..', workflow), 'utf8');
    assert.equal((source.match(/--request POST/g) ?? []).length, expectedPostCalls);
  });
}
