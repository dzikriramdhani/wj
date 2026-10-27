import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertProductionAuthorizedTarget,
  assertProductionSyntheticMutationAuthorization,
  loadProductionQaConfig,
  resolveAuthorizedProductionHost,
} from './production-test-target.mjs';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const qaConfigPath = path.join(appDirectory, '.env.qa.production');
const mode = process.argv[2];

try {
  if (mode !== '--public-preflight' && mode !== '--mutations') {
    throw new Error('Choose exactly one runner mode: --public-preflight or --mutations.');
  }

  const config = loadProductionQaConfig({ configPath: qaConfigPath });
  const target = assertProductionAuthorizedTarget(config);

  if (mode === '--mutations') {
    assertProductionSyntheticMutationAuthorization(config);
    throw new Error('No production synthetic fixture adapter is implemented; no write request was sent.');
  }

  const addresses = await resolveAuthorizedProductionHost(config);
  const paths = ['/auth/v1/health', '/rest/v1/', '/storage/v1/bucket'];
  const results = [];
  for (const pathname of paths) {
    const response = await fetch(new URL(pathname, target.url), {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    await response.body?.cancel();
    results.push({ pathname, status: response.status, redirected: response.status >= 300 && response.status < 400 });
  }

  console.log(`target_project=${target.projectRef}`);
  console.log(`target_host=${target.url.hostname}`);
  console.log(`resolved_public_addresses=${addresses.length}`);
  for (const result of results) {
    console.log(`READ_ONLY GET ${result.pathname} status=${result.status} redirected=${result.redirected}`);
  }
  if (results.some((result) => result.redirected)) {
    throw new Error('A production preflight endpoint attempted a redirect; no redirected request was followed.');
  }
  console.log('Production preflight sent GET requests only; no API key, cookie, database connection, or mutation was used.');
} catch (error) {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : 'production QA preflight failed.'}`);
  process.exitCode = 1;
}
