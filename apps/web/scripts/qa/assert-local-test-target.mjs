import { spawnSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { assertLocalProjectIdentity, assertSafeLocalTestTarget, assertSafeLocalTestConfiguration, readLocalProjectState } from './local-test-target.mjs';

const envPath = resolve('.env.test.local');

function readTestEnvironment() {
  let stat;
  try {
    stat = lstatSync(envPath);
  } catch {
    throw new Error('Missing apps/web/.env.test.local; create it from test/test-environment.env.example using local-only values.');
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('The test environment must be a regular local file, not a symlink.');
  }
  return parseEnv(readFileSync(envPath, 'utf8'));
}

function verifyPostgres(env, config) {
  const { database } = config;
  const hostAddress = config.databaseAddresses[0];
  const sql = "select json_build_object('database', current_database(), 'serverAddress', inet_server_addr()::text, 'serverPort', inet_server_port())::text;";
  const childEnv = {
    PATH: process.env.PATH ?? '',
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
    PGPASSWORD: database.password,
    PGCONNECT_TIMEOUT: '3',
    PGSSLMODE: 'disable',
  };
  const result = spawnSync('psql', [
    '-X', '--no-password', '-h', hostAddress, '-p', String(database.port),
    '-U', database.username, '-d', database.name, '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-c', sql,
  ], { encoding: 'utf8', windowsHide: true, env: childEnv });

  if (result.error || result.status !== 0 || !result.stdout?.trim()) {
    throw new Error('Could not verify PostgreSQL identity through the configured local endpoint; no mutation was attempted.');
  }
  let identity;
  try {
    identity = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error('PostgreSQL returned an unrecognized identity response; no mutation was attempted.');
  }
  return assertSafeLocalTestTarget(env, identity);
}

try {
  const projectState = readLocalProjectState();
  assertLocalProjectIdentity({ SUPABASE_PROJECT_ID: projectState.configuredProjectId }, projectState);
  const env = readTestEnvironment();
  assertLocalProjectIdentity(env, projectState);
  const config = await assertSafeLocalTestConfiguration(env);
  await verifyPostgres(env, config);
  process.stdout.write('PASS: local test environment and live PostgreSQL identity verified.\n');
} catch (error) {
  process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'local test target validation failed.'}\n`);
  process.exitCode = 1;
}
