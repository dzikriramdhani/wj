import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function routeSource(route) {
  return readFile(path.join(appRoot, route), 'utf8');
}

test('RFQ attachments compensate only request-owned paths before metadata persists', async () => {
  const source = await routeSource('src/app/api/rfq/[id]/attachments/route.ts');

  assert.match(source, /import \{ compensateUploadedObjects \} from '@\/lib\/storage-compensation';/);
  assert.match(source, /let metadataPersisted = false;/);
  assert.match(source, /metadataPersisted = true;/);
  assert.match(source, /if \(service && !metadataPersisted\)/);
  assert.match(source, /storage\.from\('rfq-files'\)\.remove\(ownedPaths\)/);
});

test('CMS asset and RFQ audit-log failures do not undo persisted uploads', async () => {
  const [assets, attachments] = await Promise.all([
    routeSource('src/app/api/super-admin/content/home/assets/route.ts'),
    routeSource('src/app/api/rfq/[id]/attachments/route.ts'),
  ]);

  assert.match(assets, /if \(auditError\) console\.error\('admin homepage asset audit logging failed', auditError\);/);
  assert.doesNotMatch(assets, /if \(auditError\) throw auditError;/);
  assert.match(attachments, /if \(auditError\) console\.error\('RFQ attachment audit logging failed', auditError\);/);
});

test('business verification document upload remains explicitly two-phase', async () => {
  const source = await routeSource('src/app/api/business/verification/documents/route.ts');

  assert.match(source, /return NextResponse\.json\(\{ documents \}, \{ status: 201 \}\)/);
  assert.doesNotMatch(source, /compensateUploadedObjects/);
});
