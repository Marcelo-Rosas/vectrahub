/**
 * Replaces dist/wrangler.json with a minimal Pages config.
 * The @cloudflare/vite-plugin generates a Workers-style config (with "assets")
 * which Pages does not support. We overwrite with Pages-only config so
 * wrangler pages deploy runs without warnings.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'dist', 'wrangler.json');

const pagesConfig = {
  name: 'vectrahub',
  pages_build_output_dir: '.',
};

writeFileSync(path, JSON.stringify(pagesConfig, null, 2), 'utf8');
console.log('patched dist/wrangler.json for Pages (removed Workers-only assets)');
