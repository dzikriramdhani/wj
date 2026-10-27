import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('admin dashboard checks role and MFA before constructing the service client', async () => {
  const source = await readFile(path.join(appRoot, 'src/app/admin/page.tsx'), 'utf8');
  const authorization = source.indexOf('const access = await getCurrentPlatformAccess();');
  const unauthenticatedRedirect = source.indexOf("if (!access.user) redirect('/login?next=/admin');");
  const roleCheck = source.indexOf('if (!access.roles.some(');
  const serviceClient = source.indexOf('const supabase = createServiceClient();');

  assert.notEqual(authorization, -1);
  assert.ok(authorization < unauthenticatedRedirect);
  assert.ok(unauthenticatedRedirect < roleCheck);
  assert.ok(roleCheck < serviceClient);
});

test('super admin user listing checks role and MFA before service-role reads', async () => {
  const source = await readFile(path.join(appRoot, 'src/app/super-admin/page.tsx'), 'utf8');
  const authorization = source.indexOf('const access = await getCurrentPlatformAccess();');
  const unauthenticatedRedirect = source.indexOf("if (!access.user) redirect('/login?next=/super-admin');");
  const roleCheck = source.indexOf("if (!access.roles.includes('super_admin'))");
  const mfaCheck = source.indexOf('if (!await hasCurrentMfaLevel2())');
  const serviceClient = source.indexOf('const service = createServiceClient();');

  assert.notEqual(authorization, -1);
  assert.ok(authorization < unauthenticatedRedirect);
  assert.ok(unauthenticatedRedirect < roleCheck);
  assert.ok(roleCheck < mfaCheck);
  assert.ok(mfaCheck < serviceClient);
});
