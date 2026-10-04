import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const envFile = process.argv[2] ?? '.env.staging';
const expectedSupabaseHost = 'aqfllncygivcvsacbfpi.supabase.co';
const content = await readFile(envFile, 'utf8');
const env = Object.fromEntries(content.split(String.fromCharCode(10)).flatMap((line) => {
  const separator = line.indexOf('=');
  if (separator < 1 || line.trimStart().startsWith('#')) return [];
  const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  return [[line.slice(0, separator).trim(), value]];
}));

const failures = [];
const warnings = [];
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'RAJAONGKIR_API_KEY', 'RAJAONGKIR_ORIGIN_ID', 'RAJAONGKIR_COURIERS', 'CRON_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM', 'EMAIL_ADMIN', 'ADMIN_MFA_REQUIRED'];
for (const name of required) if (!env[name]) failures.push(name + ' is missing');

try {
  const url = new URL(env.NEXT_PUBLIC_APP_URL ?? '');
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)) failures.push('NEXT_PUBLIC_APP_URL must be a public HTTPS STAGING domain');
  if (/(your[-.]?domain|example)/i.test(url.hostname)) failures.push('NEXT_PUBLIC_APP_URL must use the deployed STAGING domain, not a placeholder');
} catch {
  failures.push('NEXT_PUBLIC_APP_URL must be a valid public HTTPS URL');
}

try {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
  if (url.hostname !== expectedSupabaseHost) failures.push('NEXT_PUBLIC_SUPABASE_URL must use ' + expectedSupabaseHost);
} catch {
  failures.push('NEXT_PUBLIC_SUPABASE_URL must be a valid STAGING URL');
}

if (env.MIDTRANS_IS_PRODUCTION !== 'false') failures.push('MIDTRANS_IS_PRODUCTION must be false in STAGING');
if (env.ADMIN_MFA_REQUIRED !== 'true') failures.push('ADMIN_MFA_REQUIRED must be true in STAGING');
if ((env.CRON_SECRET?.length ?? 0) < 32) failures.push('CRON_SECRET must be at least 32 characters');
for (const name of ['SHIPPING_DEFAULT_WEIGHT_GRAMS_PER_METER', 'SHIPPING_PACKAGING_WEIGHT_GRAMS']) {
  if (!/^[0-9]+$/.test(env[name] ?? '') || Number(env[name]) <= 0) failures.push(name + ' must be a positive measured value');
}
if ((env.EMAIL_FROM ?? '').endsWith('@example.test') || (env.EMAIL_ADMIN ?? '').endsWith('@example.test')) failures.push('EMAIL_FROM and EMAIL_ADMIN must be STAGING addresses');
if (!env.SENTRY_DSN && !env.NEXT_PUBLIC_SENTRY_DSN) warnings.push('SENTRY_DSN is not set; application error tracking is disabled');
const erpUrl = env.ERP_WEBHOOK_URL?.trim() ?? '';
const erpSecret = env.ERP_WEBHOOK_SECRET?.trim() ?? '';
if ((erpUrl && !erpSecret) || (!erpUrl && erpSecret)) failures.push('ERP_WEBHOOK_URL and ERP_WEBHOOK_SECRET must both be set, or both left empty');
if (!env.RAJAONGKIR_COURIERS?.includes(':')) warnings.push('RAJAONGKIR_COURIERS should be a colon-separated approved courier list');

if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
  try {
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) failures.push('Supabase STAGING Admin API could not be queried');
  } catch {
    failures.push('Supabase STAGING connectivity could not be verified');
  }
}

for (const failure of failures) console.error('FAIL  ' + failure);
for (const warning of warnings) console.warn('WARN  ' + warning);
if (failures.length) process.exitCode = 1;
else console.log('PASS  Staging environment preflight succeeded.');
