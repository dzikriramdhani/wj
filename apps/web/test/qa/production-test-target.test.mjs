import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertProductionAuthorizedTarget,
  assertProductionSyntheticMutationAuthorization,
  assertStagingAuthorizedTarget,
  AUTHORIZED_PRODUCTION_PROJECT_REF,
  AUTHORIZED_PRODUCTION_SUPABASE_URL,
  loadProductionQaConfig,
} from '../../scripts/qa/production-test-target.mjs';

const base = {
  TEST_ENVIRONMENT: 'production-authorized',
  QA_PRODUCTION_AUTHORIZED: 'true',
  QA_PRODUCTION_PROJECT_REF: AUTHORIZED_PRODUCTION_PROJECT_REF,
  QA_PRODUCTION_SUPABASE_URL: AUTHORIZED_PRODUCTION_SUPABASE_URL,
};

test('accepts only the explicitly authorized production project and exact HTTPS hostname', () => {
  const target = assertProductionAuthorizedTarget(base);
  assert.equal(target.projectRef, AUTHORIZED_PRODUCTION_PROJECT_REF);
  assert.equal(target.url.hostname, `${AUTHORIZED_PRODUCTION_PROJECT_REF}.supabase.co`);
});

test('loads the dedicated production QA file and rejects unsupported secret entries', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'wj-prod-qa-'));
  const qaPath = path.join(directory, '.env.qa.production');
  try {
    writeFileSync(qaPath, [
      `TEST_ENVIRONMENT=${base.TEST_ENVIRONMENT}`,
      `QA_PRODUCTION_PROJECT_REF=${base.QA_PRODUCTION_PROJECT_REF}`,
      `QA_PRODUCTION_SUPABASE_URL=${base.QA_PRODUCTION_SUPABASE_URL}`,
      'QA_PRODUCTION_PUBLISHABLE_KEY=sb_publishable_local_placeholder',
      '',
    ].join('\n'), { flag: 'wx' });
    const config = loadProductionQaConfig({
      configPath: qaPath,
      env: { TEST_ENVIRONMENT: base.TEST_ENVIRONMENT, QA_PRODUCTION_AUTHORIZED: 'true' },
    });
    assert.equal(config.QA_PRODUCTION_PROJECT_REF, AUTHORIZED_PRODUCTION_PROJECT_REF);
    assert.equal(config.QA_PRODUCTION_PUBLISHABLE_KEY, 'sb_publishable_local_placeholder');

    writeFileSync(qaPath, 'SUPABASE_SECRET_KEY=never-display-this\n', { flag: 'w' });
    assert.throws(() => loadProductionQaConfig({ configPath: qaPath, env: { TEST_ENVIRONMENT: base.TEST_ENVIRONMENT, QA_PRODUCTION_AUTHORIZED: 'true' } }), /unsupported entry/);
  } finally {
    const resolvedTempRoot = path.resolve(os.tmpdir());
    const resolvedTestDir = path.resolve(directory);
    assert.ok(resolvedTestDir.startsWith(`${resolvedTempRoot}${path.sep}`));
    rmSync(resolvedTestDir, { recursive: true, force: true });
  }
});

test('fails closed when authorization marker, approval flag, reference, or hostname is missing or mismatched', () => {
  assert.throws(() => assertProductionAuthorizedTarget({ ...base, TEST_ENVIRONMENT: 'local' }), /production-authorized/);
  assert.throws(() => assertProductionAuthorizedTarget({ ...base, QA_PRODUCTION_AUTHORIZED: undefined }), /QA_PRODUCTION_AUTHORIZED/);
  assert.throws(() => assertProductionAuthorizedTarget({ ...base, QA_PRODUCTION_PROJECT_REF: 'other-project' }), /reference/);
  assert.throws(() => assertProductionAuthorizedTarget({ ...base, QA_PRODUCTION_SUPABASE_URL: 'https://other-project.supabase.co' }), /URL/);
  assert.throws(() => assertProductionAuthorizedTarget({ ...base, QA_PRODUCTION_SUPABASE_URL: 'http://qcgcpheeskkdcnxspbgx.supabase.co' }), /URL/);
  assert.throws(() => assertProductionAuthorizedTarget({ ...base, QA_PRODUCTION_SUPABASE_URL: `${AUTHORIZED_PRODUCTION_SUPABASE_URL}/rest/v1` }), /URL/);
  const serviceRoleLikeKey = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.throws(() => assertProductionAuthorizedTarget({ ...base, QA_PRODUCTION_PUBLISHABLE_KEY: serviceRoleLikeKey }), /publishable\/anon/);
});

test('synthetic mutation authorization requires a unique namespace and confirmed QA owner', () => {
  assert.throws(() => assertProductionSyntheticMutationAuthorization(base), /QA_ALLOW_SYNTHETIC_MUTATIONS/);

  const authorized = {
    ...base,
    QA_ALLOW_SYNTHETIC_MUTATIONS: 'true',
    QA_RUN_NAMESPACE: 'qa-run-1a2b3c4d-1234-4234-8234-123456789abc',
    QA_SYNTHETIC_OWNER_USER_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    QA_SYNTHETIC_OWNER_CONFIRMED: 'true',
  };
  assert.deepEqual(assertProductionSyntheticMutationAuthorization(authorized), {
    projectRef: AUTHORIZED_PRODUCTION_PROJECT_REF,
    namespace: authorized.QA_RUN_NAMESPACE,
    ownerUserId: authorized.QA_SYNTHETIC_OWNER_USER_ID,
    cleanupPolicy: 'created-object-ids-only',
  });
  assert.throws(() => assertProductionSyntheticMutationAuthorization({ ...authorized, QA_SYNTHETIC_OWNER_CONFIRMED: undefined }), /Confirm/);
});

test('staging mode requires a separately confirmed, non-production project and matching hostname', () => {
  const staging = {
    TEST_ENVIRONMENT: 'staging',
    QA_STAGING_AUTHORIZED: 'true',
    QA_STAGING_PROJECT_REF: 'abcdefghijklmnopqrst',
    QA_STAGING_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  };
  assert.equal(assertStagingAuthorizedTarget(staging).projectRef, staging.QA_STAGING_PROJECT_REF);
  assert.throws(() => assertStagingAuthorizedTarget({ ...staging, TEST_ENVIRONMENT: 'local' }), /TEST_ENVIRONMENT/);
  assert.throws(() => assertStagingAuthorizedTarget({ ...staging, QA_STAGING_AUTHORIZED: 'false' }), /QA_STAGING_AUTHORIZED/);
  assert.throws(() => assertStagingAuthorizedTarget({ ...staging, QA_STAGING_PROJECT_REF: AUTHORIZED_PRODUCTION_PROJECT_REF }), /non-production/);
  assert.throws(() => assertStagingAuthorizedTarget({ ...staging, QA_STAGING_SUPABASE_URL: 'https://other-project.supabase.co' }), /does not match/);
});
