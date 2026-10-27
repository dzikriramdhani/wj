import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLocalProjectIdentity, assertSafeLocalTestConfiguration, assertSafeLocalTestTarget, FORBIDDEN_SUPABASE_PROJECT_REF } from '../../scripts/qa/local-test-target.mjs';

const localEnv = {
  TEST_ENVIRONMENT: 'local',
  SUPABASE_PROJECT_REF: 'local',
  SUPABASE_PROJECT_ID: 'winajaya',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  DATABASE_URL: 'postgresql://postgres:local-placeholder@127.0.0.1:54322/postgres',
};
const localIdentity = { database: 'postgres', serverAddress: '127.0.0.1', serverPort: 54322 };

test('accepts explicit local targets and matching live database identity', async () => {
  const config = await assertSafeLocalTestTarget(localEnv, localIdentity);
  assert.equal(config.database.name, 'postgres');
  assert.deepEqual(config.databaseAddresses, ['127.0.0.1']);
});

test('fails closed when the explicit test marker or project reference is missing', async () => {
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, TEST_ENVIRONMENT: undefined }), /TEST_ENVIRONMENT/);
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, SUPABASE_PROJECT_REF: undefined }), /SUPABASE_PROJECT_REF/);
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, SUPABASE_PROJECT_ID: undefined }), /SUPABASE_PROJECT_ID/);
});

test('rejects the production project reference in endpoint, database, or project identity', async () => {
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, SUPABASE_URL: `https://${FORBIDDEN_SUPABASE_PROJECT_REF}.supabase.co` }), /forbidden production/);
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, DATABASE_URL: `postgresql://postgres:local@${FORBIDDEN_SUPABASE_PROJECT_REF}.supabase.co:54322/postgres` }), /forbidden production/);
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, SUPABASE_PROJECT_REF: FORBIDDEN_SUPABASE_PROJECT_REF }), /SUPABASE_PROJECT_REF/);
});

test('rejects a repository link to production or any unknown remote project', () => {
  assert.throws(() => assertLocalProjectIdentity(localEnv, { configuredProjectId: 'winajaya', linkedProjectRef: FORBIDDEN_SUPABASE_PROJECT_REF }), /forbidden production/);
  assert.throws(() => assertLocalProjectIdentity(localEnv, { configuredProjectId: 'winajaya', linkedProjectRef: 'unknown-remote-project' }), /remote or unknown/);
  assert.throws(() => assertLocalProjectIdentity(localEnv, { configuredProjectId: 'other', linkedProjectRef: null }), /does not match/);
  assert.doesNotThrow(() => assertLocalProjectIdentity(localEnv, { configuredProjectId: 'winajaya', linkedProjectRef: null }));
});

test('rejects unknown remote endpoints even with the local marker', async () => {
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, SUPABASE_URL: 'https://db.example.invalid' }), /local URL/);
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, DATABASE_URL: 'postgresql://postgres:local@db.example.invalid:54322/postgres' }), /must use localhost or a loopback/);
});

test('rejects unsupported environment values such as provider credentials or arbitrary overrides', async () => {
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, SUPABASE_SECRET_KEY: 'not-read-or-used' }), /unsupported variables/);
});

test('rejects mismatched Supabase aliases, ports, database names, and credentials embedded in API URLs', async () => {
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321/other' }), /must match/);
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, SUPABASE_URL: 'http://127.0.0.1:54322' }), /must match/);
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, DATABASE_URL: 'postgresql://postgres:local@127.0.0.1:54322/other' }), /DATABASE_URL/);
  await assert.rejects(assertSafeLocalTestConfiguration({ ...localEnv, SUPABASE_URL: 'http://user:pass@127.0.0.1:54321' }), /without embedded credentials/);
});

test('rejects absent or mismatched live database identity', async () => {
  await assert.rejects(assertSafeLocalTestTarget(localEnv, undefined), /live PostgreSQL identity/);
  await assert.rejects(assertSafeLocalTestTarget(localEnv, { ...localIdentity, serverAddress: '203.0.113.10' }), /not loopback/);
  await assert.rejects(assertSafeLocalTestTarget(localEnv, { ...localIdentity, serverPort: 5432 }), /live PostgreSQL identity/);
  await assert.rejects(assertSafeLocalTestTarget(localEnv, { ...localIdentity, database: 'user_data' }), /live PostgreSQL identity/);
});
