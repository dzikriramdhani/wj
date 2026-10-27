import { cp, lstat, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const buildPrefix = path.join(appDirectory, '.qa-isolated-build-');
const temporaryDirectory = await mkdtemp(buildPrefix);
const nextBinary = path.join(appDirectory, 'node_modules', 'next', 'dist', 'bin', 'next');
const buildArguments = process.argv.slice(2);
const useWebpack = buildArguments.includes('--webpack');
const useRouteProbe = buildArguments.includes('--probe');
const excludedEntries = new Set([
  '.git', '.next', '.test-build', 'node_modules', 'package-lock.json', 'test-results',
]);

if (
  buildArguments.length > 2
  || buildArguments.some((argument) => argument !== '--webpack' && argument !== '--probe')
  || new Set(buildArguments).size !== buildArguments.length
) {
  throw new Error('The isolated build accepts optional --webpack and --probe arguments only once each.');
}

if (!existsSync(nextBinary)) {
  throw new Error('The local Next.js binary is required for the isolated build.');
}

function isExcluded(name) {
  return excludedEntries.has(name) || name.startsWith('.env') || name.startsWith('.qa-');
}

function safeSystemEnvironment() {
  const childEnvironment = {};
  for (const name of [
    'APPDATA', 'COMSPEC', 'LOCALAPPDATA', 'NUMBER_OF_PROCESSORS', 'OS',
    'PATH', 'PATHEXT', 'PROCESSOR_ARCHITECTURE', 'PROCESSOR_IDENTIFIER',
    'PROCESSOR_LEVEL', 'PROCESSOR_REVISION', 'SystemDrive', 'SystemRoot',
    'TEMP', 'TMP', 'USERPROFILE', 'WINDIR',
  ]) {
    if (typeof process.env[name] === 'string' && process.env[name]) {
      childEnvironment[name] = process.env[name];
    }
  }

  return {
    ...childEnvironment,
    APP_URL: 'http://127.0.0.1:3100',
    CI: '1',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-qa-placeholder-publishable-key',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_ENV: 'production',
    SUPABASE_SECRET_KEY: '',
  };
}

async function copyApplication() {
  if (useRouteProbe) {
    const routeDirectory = path.join(temporaryDirectory, 'app', 'api', 'products', '[slug]');
    await mkdir(routeDirectory, { recursive: true });
    await Promise.all([
      writeFile(path.join(temporaryDirectory, 'package.json'), '{"name":"qa-next-route-probe","private":true}\n'),
      writeFile(path.join(temporaryDirectory, 'next.config.mjs'), 'export default { output: \'standalone\' };\n'),
      writeFile(path.join(temporaryDirectory, 'app', 'layout.js'), 'export default function RootLayout({ children }) { return <html><body>{children}</body></html>; }\n'),
      writeFile(path.join(temporaryDirectory, 'app', 'page.js'), "export default function Page() { return 'QA route probe'; }\n"),
      writeFile(path.join(routeDirectory, 'route.js'), "export function GET() { return Response.json({ ok: true }); }\n"),
    ]);
    return;
  }

  const entries = await readdir(appDirectory, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => !isExcluded(entry.name))
    .map((entry) => cp(
      path.join(appDirectory, entry.name),
      path.join(temporaryDirectory, entry.name),
      { recursive: entry.isDirectory(), force: false, verbatimSymlinks: true },
    )));
}

let buildChild = null;
let interrupted = false;

function runBuild() {
  return new Promise((resolve, reject) => {
    buildChild = spawn(process.execPath, [nextBinary, 'build', ...(useWebpack ? ['--webpack'] : []), temporaryDirectory], {
      cwd: temporaryDirectory,
      env: safeSystemEnvironment(),
      stdio: 'inherit',
    });
    buildChild.once('error', reject);
    buildChild.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    interrupted = true;
    buildChild?.kill(signal);
  });
}

try {
  await copyApplication();
  const exitCode = await runBuild();
  process.exitCode = interrupted ? 130 : exitCode;
} finally {
  const metadata = await lstat(temporaryDirectory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || !temporaryDirectory.startsWith(buildPrefix)) {
    throw new Error('Refusing to remove an unexpected isolated build directory.');
  }
  await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 2 });
}
