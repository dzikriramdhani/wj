import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const envFile = process.argv[2] ?? '.env';
const content = await readFile(envFile, 'utf8');
const env = Object.fromEntries(content.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  return match ? [[match[1], match[2].trim().replace(/^['"]|['"]$/g, '')]] : [];
}));
const failures = [];
const warnings = [];
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'MIDTRANS_SERVER_KEY',
  'MIDTRANS_CLIENT_KEY',
  'RAJAONGKIR_API_KEY',
  'RAJAONGKIR_ORIGIN_ID',
  'RAJAONGKIR_COURIERS',
  'CRON_SECRET',
  'SCHEDULER_CRON_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'EMAIL_FROM',
  'EMAIL_ADMIN',
  'ADMIN_MFA_REQUIRED',
  'SENTRY_DSN',
];
for (const name of required) if (!env[name]) failures.push(`${name} is missing`);
const appUrl = env.NEXT_PUBLIC_APP_URL ?? '';
try {
  const url = new URL(appUrl);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)) {
    failures.push('NEXT_PUBLIC_APP_URL must be a public HTTPS domain');
  }
} catch {
  failures.push('NEXT_PUBLIC_APP_URL must be a valid public HTTPS URL');
}

const integrationMode = env.PRODUCTION_INTEGRATION_MODE ?? 'live';
if (!['live', 'sandbox'].includes(integrationMode)) {
  failures.push('PRODUCTION_INTEGRATION_MODE must be either live or sandbox');
}

const midtransLive = env.MIDTRANS_IS_PRODUCTION === 'true';
if (integrationMode === 'live' && !midtransLive) {
  failures.push('MIDTRANS_IS_PRODUCTION must be true when PRODUCTION_INTEGRATION_MODE=live');
}
if (integrationMode === 'sandbox' && midtransLive) {
  failures.push('MIDTRANS_IS_PRODUCTION must be false when PRODUCTION_INTEGRATION_MODE=sandbox');
}

if (env.ADMIN_MFA_REQUIRED !== 'true') {
  failures.push('ADMIN_MFA_REQUIRED must be true for a production release');
}
if ((env.CRON_SECRET?.length ?? 0) < 32) failures.push('CRON_SECRET must be at least 32 characters');
if ((env.SCHEDULER_CRON_SECRET?.length ?? 0) < 32) failures.push('SCHEDULER_CRON_SECRET must be at least 32 characters');
if (env.SCHEDULER_CRON_SECRET && env.CRON_SECRET && env.SCHEDULER_CRON_SECRET === env.CRON_SECRET) {
  failures.push('SCHEDULER_CRON_SECRET must be separate from CRON_SECRET');
}
if (!/^\d+$/.test(env.SHIPPING_DEFAULT_WEIGHT_GRAMS_PER_METER ?? '') || Number(env.SHIPPING_DEFAULT_WEIGHT_GRAMS_PER_METER) <= 0) {
  failures.push('SHIPPING_DEFAULT_WEIGHT_GRAMS_PER_METER must be a positive measured value');
}
if (!/^\d+$/.test(env.SHIPPING_PACKAGING_WEIGHT_GRAMS ?? '') || Number(env.SHIPPING_PACKAGING_WEIGHT_GRAMS) <= 0) {
  failures.push('SHIPPING_PACKAGING_WEIGHT_GRAMS must be a positive measured value');
}
if ((env.EMAIL_FROM ?? '').endsWith('@example.test') || (env.EMAIL_ADMIN ?? '').endsWith('@example.test')) {
  failures.push('EMAIL_FROM and EMAIL_ADMIN must be real production addresses');
}
if (env.NEXT_PUBLIC_APP_URL.includes('winajaya.test')) failures.push('NEXT_PUBLIC_APP_URL cannot use a test domain');

const erpUrl = env.ERP_WEBHOOK_URL?.trim() ?? '';
const erpSecret = env.ERP_WEBHOOK_SECRET?.trim() ?? '';
if ((erpUrl && !erpSecret) || (!erpUrl && erpSecret)) {
  failures.push('ERP_WEBHOOK_URL and ERP_WEBHOOK_SECRET must both be set, or both left empty');
}
if (erpUrl.includes('example.')) warnings.push('ERP_WEBHOOK_URL points to an example domain');

if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
  try {
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) failures.push('Supabase Admin API could not be queried');
    else if (data.users.some((user) => user.email?.endsWith('@winajaya.test'))) {
      failures.push('This Supabase project contains @winajaya.test accounts from DEV; use a separate production project');
    }
  } catch {
    failures.push('Supabase connectivity could not be verified');
  }
}
if (!env.RAJAONGKIR_COURIERS?.includes(':')) warnings.push('RAJAONGKIR_COURIERS should be a colon-separated approved courier list');
if (integrationMode === 'sandbox') {
  warnings.push('Sandbox integration mode is enabled: this deployment must not be presented as live payment or live shipping service.');
}

for (const failure of failures) console.error(`FAIL  ${failure}`);
for (const warning of warnings) console.warn(`WARN  ${warning}`);

if (failures.length) process.exitCode = 1;
else console.log(`PASS  Production environment preflight succeeded (${integrationMode} integration mode).`);
