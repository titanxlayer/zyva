// Assemble the Next standalone dir before packaging: ensure static + public
// live inside .next/standalone so a single extraResources rule can ship it.
// Uses force-overwrite so it is safe whether or not Next already bundled them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standalone = path.join(root, '.next', 'standalone');

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  console.error('[prepackage] .next/standalone/server.js not found — run "npm run build" first.');
  process.exit(1);
}

function copyInto(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
  console.log(`[prepackage] copied ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

copyInto(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'));
copyInto(path.join(root, 'public'), path.join(standalone, 'public'));
console.log('[prepackage] standalone assembled.');
