import { lookup } from 'node:dns/promises';
import { lstatSync, readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { parseEnv } from 'node:util';

export const AUTHORIZED_PRODUCTION_PROJECT_REF = 'qcgcpheeskkdcnxspbgx';
export const AUTHORIZED_PRODUCTION_SUPABASE_URL = `https://${AUTHORIZED_PRODUCTION_PROJECT_REF}.supabase.co`;

const configKeys = new Set([
  'TEST_ENVIRONMENT',
  'QA_PRODUCTION_PROJECT_REF',
  'QA_PRODUCTION_SUPABASE_URL',
  'QA_PRODUCTION_PUBLISHABLE_KEY',
]);

function fail(message) {
  throw new Error(message);
}

function isPublicAnonKey(value) {
  if (!value) return true;
  if (value.startsWith('sb_publishable_')) return true;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role === 'anon';
  } catch {
    return false;
  }
}

function selectProcessFlags(env) {
  return {
    TEST_ENVIRONMENT: env.TEST_ENVIRONMENT,
    QA_PRODUCTION_AUTHORIZED: env.QA_PRODUCTION_AUTHORIZED,
    QA_ALLOW_SYNTHETIC_MUTATIONS: env.QA_ALLOW_SYNTHETIC_MUTATIONS,
    QA_RUN_NAMESPACE: env.QA_RUN_NAMESPACE,
    QA_SYNTHETIC_OWNER_USER_ID: env.QA_SYNTHETIC_OWNER_USER_ID,
    QA_SYNTHETIC_OWNER_CONFIRMED: env.QA_SYNTHETIC_OWNER_CONFIRMED,
    QA_PRODUCTION_PROJECT_REF: env.QA_PRODUCTION_PROJECT_REF,
    QA_PRODUCTION_SUPABASE_URL: env.QA_PRODUCTION_SUPABASE_URL,
  };
}

/** Read only the dedicated QA config. Never load .env, .env.local, or dotenv defaults. */
export function loadProductionQaConfig({ env = process.env, configPath = '.env.qa.production' } = {}) {
  const flags = selectProcessFlags(env);
  let fileConfig = {};
  try {
    const stat = lstatSync(configPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('Production QA config must be a regular file, not a symlink.');
    }
    fileConfig = parseEnv(readFileSync(configPath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (Object.keys(fileConfig).some((key) => !configKeys.has(key))) {
    fail('Production QA config contains an unsupported entry; its values were not displayed.');
  }

  for (const key of ['TEST_ENVIRONMENT', 'QA_PRODUCTION_PROJECT_REF', 'QA_PRODUCTION_SUPABASE_URL']) {
    if (fileConfig[key] && flags[key] && fileConfig[key] !== flags[key]) {
      fail(`Production QA process target does not match its dedicated config (${key}).`);
    }
  }

  return {
    ...flags,
    TEST_ENVIRONMENT: flags.TEST_ENVIRONMENT || fileConfig.TEST_ENVIRONMENT,
    QA_PRODUCTION_PROJECT_REF: fileConfig.QA_PRODUCTION_PROJECT_REF || flags.QA_PRODUCTION_PROJECT_REF,
    QA_PRODUCTION_SUPABASE_URL: fileConfig.QA_PRODUCTION_SUPABASE_URL || flags.QA_PRODUCTION_SUPABASE_URL,
    // This key is optional and is intentionally never used by public preflight.
    QA_PRODUCTION_PUBLISHABLE_KEY: fileConfig.QA_PRODUCTION_PUBLISHABLE_KEY,
  };
}

export function assertProductionAuthorizedTarget(config) {
  if (config.TEST_ENVIRONMENT !== 'production-authorized') {
    fail('TEST_ENVIRONMENT must be explicitly set to production-authorized.');
  }
  if (config.QA_PRODUCTION_AUTHORIZED !== 'true') {
    fail('QA_PRODUCTION_AUTHORIZED=true must be explicitly set in the process environment.');
  }
  if (config.QA_PRODUCTION_PROJECT_REF !== AUTHORIZED_PRODUCTION_PROJECT_REF) {
    fail('Production project reference does not match the confirmed target.');
  }
  if (config.QA_PRODUCTION_SUPABASE_URL !== AUTHORIZED_PRODUCTION_SUPABASE_URL) {
    fail('Production Supabase URL does not match the confirmed HTTPS hostname.');
  }

  const url = new URL(config.QA_PRODUCTION_SUPABASE_URL);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== `${AUTHORIZED_PRODUCTION_PROJECT_REF}.supabase.co` ||
    (url.port && url.port !== '443') ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash
  ) {
    fail('Production Supabase URL is ambiguous or outside the confirmed project hostname.');
  }

  if (!isPublicAnonKey(config.QA_PRODUCTION_PUBLISHABLE_KEY)) {
    fail('Only a publishable/anon Supabase API key may be configured for read-only QA; service credentials are rejected.');
  }

  return { projectRef: AUTHORIZED_PRODUCTION_PROJECT_REF, url };
}

export function assertStagingAuthorizedTarget(config) {
  if (config.TEST_ENVIRONMENT !== 'staging') {
    fail('TEST_ENVIRONMENT must be explicitly set to staging.');
  }
  if (config.QA_STAGING_AUTHORIZED !== 'true') {
    fail('QA_STAGING_AUTHORIZED=true must be explicitly set for remote staging checks.');
  }
  const ref = config.QA_STAGING_PROJECT_REF;
  if (!/^[a-z0-9]{20}$/.test(ref ?? '') || ref === AUTHORIZED_PRODUCTION_PROJECT_REF) {
    fail('A dedicated non-production staging project reference is required.');
  }
  let url;
  try { url = new URL(config.QA_STAGING_SUPABASE_URL); } catch { fail('Staging Supabase URL is missing or invalid.'); }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== `${ref}.supabase.co` ||
    (url.port && url.port !== '443') ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash
  ) {
    fail('Staging Supabase URL does not match its explicitly configured project reference.');
  }
  return { projectRef: ref, url };
}

export function assertProductionSyntheticMutationAuthorization(config) {
  assertProductionAuthorizedTarget(config);
  if (config.QA_ALLOW_SYNTHETIC_MUTATIONS !== 'true') {
    fail('Synthetic production mutations require QA_ALLOW_SYNTHETIC_MUTATIONS=true.');
  }
  if (!/^qa-[a-z0-9]{2,16}-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.QA_RUN_NAMESPACE ?? '')) {
    fail('Synthetic production mutations require a unique qa-<run>-<uuid> namespace.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.QA_SYNTHETIC_OWNER_USER_ID ?? '')) {
    fail('Synthetic production mutations require the confirmed QA owner user UUID.');
  }
  if (config.QA_SYNTHETIC_OWNER_CONFIRMED !== 'true') {
    fail('Confirm that the synthetic owner belongs to this QA run before mutation tests.');
  }
  return {
    projectRef: AUTHORIZED_PRODUCTION_PROJECT_REF,
    namespace: config.QA_RUN_NAMESPACE,
    ownerUserId: config.QA_SYNTHETIC_OWNER_USER_ID,
    cleanupPolicy: 'created-object-ids-only',
  };
}

function isPublicAddress(address) {
  const value = address.toLowerCase().split('%')[0];
  if (isIP(value) === 4) {
    const parts = value.split('.').map(Number);
    const [a, b] = parts;
    if (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19))
    ) return false;
    return true;
  }
  if (isIP(value) === 6) {
    return !(
      value === '::' || value === '::1' ||
      value.startsWith('fc') || value.startsWith('fd') ||
      /^fe[89ab]/.test(value) || value.startsWith('ff') ||
      value.startsWith('::ffff:')
    );
  }
  return false;
}

export async function resolveAuthorizedProductionHost(config) {
  const { url } = assertProductionAuthorizedTarget(config);
  let records;
  try {
    records = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    fail('Confirmed production hostname could not be resolved from this environment; no HTTP request was sent.');
  }
  if (!records.length || records.some(({ address }) => !isPublicAddress(address))) {
    fail('Confirmed production hostname did not resolve exclusively to public addresses; no HTTP request was sent.');
  }
  return records.map(({ address }) => address);
}
