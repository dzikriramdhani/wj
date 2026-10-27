import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const standaloneDirectory = path.join(appDirectory, '.next', 'standalone');
const baseURL = process.env.QA_LOCAL_APP_URL;

if (process.env.QA_LOCAL_APP_MARKER !== 'local') {
  throw new Error('Set QA_LOCAL_APP_MARKER=local before starting the isolated standalone app.');
}
if (baseURL !== 'http://127.0.0.1:3100/') {
  throw new Error('The QA standalone app is fixed to http://127.0.0.1:3100/.');
}
if (!existsSync(path.join(standaloneDirectory, 'server.js'))) {
  throw new Error('Build the app before starting the standalone QA server.');
}

const standaloneEntries = await readdir(standaloneDirectory);
if (standaloneEntries.some((name) => name.startsWith('.env'))) {
  throw new Error('Standalone output contains an env file; refusing to start it.');
}

await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', (error) => reject(new Error(`Local port 3100 is unavailable: ${error.code}`)));
  probe.listen(3100, '127.0.0.1', () => probe.close(resolve));
});

const childEnvironment = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  WINDIR: process.env.WINDIR,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  NODE_ENV: 'production',
  HOSTNAME: '127.0.0.1',
  PORT: '3100',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-qa-placeholder-publishable-key',
  SUPABASE_SECRET_KEY: '',
  APP_URL: 'http://127.0.0.1:3100',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
};

const child = spawn(process.execPath, ['server.js'], {
  cwd: standaloneDirectory,
  env: childEnvironment,
  stdio: 'inherit',
});

process.once('SIGINT', () => child.kill());
process.once('SIGTERM', () => child.kill());
child.once('error', (error) => {
  console.error(`Local standalone server failed to start: ${error.message}`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
