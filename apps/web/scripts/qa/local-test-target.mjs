import { lookup } from 'node:dns/promises';
import { readFileSync, lstatSync } from 'node:fs';
import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_SUPABASE_PROJECT_REF = 'qcgcpheeskkdcnxspbgx';
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repositoryRoot = resolve(appRoot, '../..');

function fail(message) {
  throw new Error(message);
}

export function readLocalProjectState() {
  const configPath = resolve(repositoryRoot, 'supabase/config.toml');
  const config = readFileSync(configPath, 'utf8');
  const match = config.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  if (!match) fail('Could not identify project_id from the repository Supabase config.');

  const linkedRefPath = resolve(repositoryRoot, 'supabase/.temp/project-ref');
  let linkedProjectRef = null;
  try {
    const stat = lstatSync(linkedRefPath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('Supabase link metadata is not a regular local file.');
    linkedProjectRef = readFileSync(linkedRefPath, 'utf8').trim() || null;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  return { configuredProjectId: match[1], linkedProjectRef };
}

export function assertLocalProjectIdentity(env, { configuredProjectId, linkedProjectRef }) {
  if (configuredProjectId !== 'winajaya' || env.SUPABASE_PROJECT_ID !== configuredProjectId) {
    fail('The configured Supabase project id does not match the expected local project.');
  }
  if (linkedProjectRef === FORBIDDEN_SUPABASE_PROJECT_REF) {
    fail('Supabase CLI link metadata identifies the forbidden production project; no test or migration was started.');
  }
  if (linkedProjectRef && linkedProjectRef !== configuredProjectId) {
    fail('Supabase CLI is linked to a remote or unknown project; remote targets are not accepted.');
  }
}

function normalizedHost(hostname) {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1).toLowerCase()
    : hostname.toLowerCase();
}

export function isLoopbackAddress(address) {
  const value = address.toLowerCase().split('%')[0];
  if (isIP(value) === 4) return value.startsWith('127.');
  return isIP(value) === 6 && (value === '::1' || value === '0:0:0:0:0:0:0:1');
}

async function resolveLocalHost(hostname, label) {
  const host = normalizedHost(hostname);
  if (host !== 'localhost' && !isLoopbackAddress(host)) {
    fail(`${label} must use localhost or a loopback IP address.`);
  }

  const records = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true });
  if (records.length === 0 || records.some(({ address }) => !isLoopbackAddress(address))) {
    fail(`${label} did not resolve exclusively to loopback addresses.`);
  }
  return [...new Set(records.map(({ address }) => address))];
}

function parseTargetUrl(value, label, protocols, allowCredentials = false) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} is missing or invalid.`);
  }
  if (!protocols.includes(url.protocol) || (!allowCredentials && (url.username || url.password)) || url.search || url.hash) {
    fail(`${label} must be a local URL without embedded credentials or extra parameters.`);
  }
  return url;
}

export async function assertSafeLocalTestConfiguration(env) {
  const allowedVariables = new Set([
    'TEST_ENVIRONMENT', 'SUPABASE_PROJECT_REF', 'SUPABASE_PROJECT_ID',
    'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'DATABASE_URL',
  ]);
  if (Object.keys(env).some((name) => !allowedVariables.has(name))) {
    fail('The local integration environment contains unsupported variables; only local target identity variables are accepted.');
  }
  if (env.TEST_ENVIRONMENT !== 'local') {
    fail('TEST_ENVIRONMENT must be explicitly set to local.');
  }
  if (env.SUPABASE_PROJECT_REF !== 'local') {
    fail('SUPABASE_PROJECT_REF must be local.');
  }
  if (env.SUPABASE_PROJECT_ID !== 'winajaya') {
    fail('SUPABASE_PROJECT_ID must match the repository local Supabase project_id.');
  }

  const targetValues = [
    env.SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_TEST_URL,
    env.DATABASE_URL,
    env.SUPABASE_PROJECT_REF,
    env.SUPABASE_PROJECT_ID,
  ].filter(Boolean);
  if (targetValues.some((value) => value.toLowerCase().includes(FORBIDDEN_SUPABASE_PROJECT_REF))) {
    fail('The configured target contains the forbidden production Supabase project reference.');
  }

  if (!env.SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_URL || !env.DATABASE_URL) {
    fail('SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and DATABASE_URL are required.');
  }

  const apiUrl = parseTargetUrl(env.SUPABASE_URL, 'SUPABASE_URL', ['http:']);
  const publicApiUrl = parseTargetUrl(env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL', ['http:']);
  if (apiUrl.href !== publicApiUrl.href || apiUrl.port !== '54321' || apiUrl.pathname !== '/') {
    fail('Supabase server and browser URLs must match the local API endpoint on port 54321.');
  }

  const databaseUrl = parseTargetUrl(env.DATABASE_URL, 'DATABASE_URL', ['postgres:', 'postgresql:'], true);
  if (databaseUrl.port !== '54322' || databaseUrl.pathname !== '/postgres' || databaseUrl.username !== 'postgres' || !databaseUrl.password) {
    fail('DATABASE_URL must identify the local Supabase postgres database on port 54322 with an explicit local password.');
  }

  const [apiAddresses, databaseAddresses] = await Promise.all([
    resolveLocalHost(apiUrl.hostname, 'Supabase API host'),
    resolveLocalHost(databaseUrl.hostname, 'Database host'),
  ]);

  return {
    apiAddresses,
    databaseAddresses,
    database: {
      host: normalizedHost(databaseUrl.hostname),
      username: decodeURIComponent(databaseUrl.username),
      password: decodeURIComponent(databaseUrl.password),
      name: databaseUrl.pathname.slice(1),
      port: Number(databaseUrl.port),
    },
  };
}

export async function assertSafeLocalTestTarget(env, identity) {
  const config = await assertSafeLocalTestConfiguration(env);
  if (!identity || identity.database !== 'postgres' || identity.serverPort !== 54322) {
    fail('The live PostgreSQL identity did not match the expected local Supabase database.');
  }
  if (!identity.serverAddress || !isLoopbackAddress(identity.serverAddress)) {
    fail('The live PostgreSQL server address is not loopback.');
  }
  if (!config.databaseAddresses.includes(identity.serverAddress)) {
    fail('The live PostgreSQL server address did not match the resolved local database host.');
  }
  return config;
}
