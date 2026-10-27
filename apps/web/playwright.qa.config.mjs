import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const target = process.env.QA_LOCAL_APP_URL;
if (process.env.QA_LOCAL_APP_MARKER !== 'local') {
  throw new Error('Set QA_LOCAL_APP_MARKER=local to confirm an isolated local E2E run.');
}
if (!target) throw new Error('Set QA_LOCAL_APP_URL to the local test application URL.');

const baseURL = new URL(target);
if (
  baseURL.protocol !== 'http:' ||
  baseURL.hostname !== '127.0.0.1' ||
  baseURL.port !== '3100' ||
  baseURL.username ||
  baseURL.password ||
  baseURL.pathname !== '/' ||
  baseURL.search ||
  baseURL.hash
) {
  throw new Error('Local E2E accepts only http://127.0.0.1:3100/.');
}

const executablePath = process.env.QA_LOCAL_CHROMIUM_EXECUTABLE;
let launchOptions;
if (executablePath) {
  const browserCache = path.resolve(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  const resolvedExecutable = path.resolve(executablePath);
  if (
    !resolvedExecutable.startsWith(`${browserCache}${path.sep}`) ||
    !existsSync(resolvedExecutable)
  ) {
    throw new Error('QA_LOCAL_CHROMIUM_EXECUTABLE must be an existing browser inside the local Playwright cache.');
  }
  launchOptions = { executablePath: resolvedExecutable };
}

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/qa-local-e2e',
  use: {
    baseURL: baseURL.toString(),
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions,
  },
});
