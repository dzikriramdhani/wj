import { spawnSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { assertLocalProjectIdentity, assertSafeLocalTestTarget, assertSafeLocalTestConfiguration, readLocalProjectState } from './local-test-target.mjs';

const envPath = resolve('.env.test.local');
const identitySql = "select json_build_object('database', current_database(), 'serverAddress', inet_server_addr()::text, 'serverPort', inet_server_port())::text;";

function safeTestEnvironment() {
  const stat = lstatSync(envPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('The test environment must be a regular local file, not a symlink.');
  return parseEnv(readFileSync(envPath, 'utf8'));
}

function queryDatabaseIdentity(config) {
  const { database } = config;
  const args = ['-X', '--no-password', '-h', config.databaseAddresses[0], '-p', String(database.port), '-U', database.username, '-d', database.name, '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-c', identitySql];
  const env = {
    PATH: process.env.PATH ?? '',
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
    PGPASSWORD: database.password,
    PGCONNECT_TIMEOUT: '3',
    PGSSLMODE: 'disable',
  };
  const result = spawnSync('psql', args, { encoding: 'utf8', windowsHide: true, env });
  if (result.error || result.status !== 0 || !result.stdout?.trim()) throw new Error('Could not verify the live local PostgreSQL identity; no test was started.');
  try { return JSON.parse(result.stdout.trim()); } catch { throw new Error('PostgreSQL returned an invalid identity response; no test was started.'); }
}

try {
  const projectState = readLocalProjectState();
  assertLocalProjectIdentity({ SUPABASE_PROJECT_ID: projectState.configuredProjectId }, projectState);
  const env = safeTestEnvironment();
  assertLocalProjectIdentity(env, projectState);
  const config = await assertSafeLocalTestConfiguration(env);
  const identity = queryDatabaseIdentity(config);
  await assertSafeLocalTestTarget(env, identity);

  // Do not inherit the desktop/session environment or read any production .env file.
  const childEnv = {
    TEST_ENVIRONMENT: env.TEST_ENVIRONMENT,
    SUPABASE_PROJECT_REF: env.SUPABASE_PROJECT_REF,
    SUPABASE_PROJECT_ID: env.SUPABASE_PROJECT_ID,
    SUPABASE_URL: env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    DATABASE_URL: env.DATABASE_URL,
    PATH: process.env.PATH ?? '',
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
    NODE_ENV: 'test',
  };
  const testRunner = spawnSync(process.execPath, [
    '--experimental-test-isolation=none', '--test',
    '.test-build/test/integration/*.test.js',
  ], { encoding: 'utf8', windowsHide: true, env: childEnv });
  if (testRunner.stdout) process.stdout.write(testRunner.stdout);
  if (testRunner.stderr) process.stderr.write(testRunner.stderr);
  if (testRunner.error) throw new Error('Could not start the isolated integration test runner.');
  process.exitCode = testRunner.status ?? 1;
} catch (error) {
  process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'local integration preflight failed.'}\n`);
  process.exitCode = 1;
}
