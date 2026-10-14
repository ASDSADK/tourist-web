import { build } from 'vite';
import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const appRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
await build({ root: appRoot, base: './', mode: 'pages', build: { outDir: 'dist-pages' } });
const assets = join(appRoot, 'dist-pages', 'assets');
await mkdir(join(repoRoot, 'assets'), { recursive: true });
// Copy generated files only; do not remove pre-existing repository assets.
for (const name of await readdir(assets)) await copyFile(join(assets, name), join(repoRoot, 'assets', name));
await copyFile(join(appRoot, 'dist-pages', 'index.html'), join(repoRoot, 'index.html'));
await writeFile(join(repoRoot, '.nojekyll'), '');
console.log('Updated repository index.html and assets/ with the labelled static demo.');
