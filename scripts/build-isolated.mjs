import { cp, mkdir, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Build exact copies of the repository inputs with its unchanged lockfile.
// This mode confines dependency installations to disposable test scaffolding.
const root = resolve('.');
const stage = resolve('test/scratch/build');
await mkdir(stage, { recursive: true });
for (const path of ['src', 'public', 'tests', 'scripts', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts']) {
  await rm(resolve(stage, path), { recursive: true, force: true });
  await cp(resolve(root, path), resolve(stage, path), { recursive: true });
}
await rm(resolve(stage, 'dist'), { recursive: true, force: true });
function run(args, cwd = stage) {
  const result = spawnSync('npm', args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!process.argv.includes('--reuse-install')) {
  run(['ci', '--cache', resolve('test/scratch/npm-cache'), '--no-audit', '--no-fund']);
} else {
  // Used only after a successful locked install in this stage.
  await readFile(resolve(stage, 'node_modules/.package-lock.json'));
}
run(['run', 'typecheck']);
run(['test']);
run(['run', 'build']);
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await cp(resolve(stage, 'dist'), resolve(root, 'dist'), { recursive: true });
run(['run', 'check:export'], root);
run(['run', 'check:http'], root);
