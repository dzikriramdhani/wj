import { lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const nextDirectory = path.resolve(appDirectory, '.next');
const generatedTypeDirectories = [
  path.resolve(nextDirectory, 'dev', 'types'),
  path.resolve(nextDirectory, 'types'),
];

for (const generatedTypesDirectory of generatedTypeDirectories) {
  if (!generatedTypesDirectory.startsWith(`${nextDirectory}${path.sep}`)) {
    throw new Error('Refusing to remove a path outside the generated .next directory.');
  }

  try {
    const metadata = await lstat(generatedTypesDirectory);
    if (metadata.isSymbolicLink()) {
      throw new Error('Refusing to remove symbolic-link generated type directory.');
    }
    if (!metadata.isDirectory()) {
      throw new Error('Expected generated Next.js types to be a directory.');
    }
    await rm(generatedTypesDirectory, { recursive: true, force: true, maxRetries: 2 });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
