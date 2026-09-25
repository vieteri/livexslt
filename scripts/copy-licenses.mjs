import { mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
const target = path.join(process.cwd(), 'public', 'licenses');
await mkdir(target, { recursive: true });
for (const candidate of ['node_modules/xslt-processor/dist/LICENSE', 'node_modules/xslt-processor/LICENSE']) {
  try { await access(candidate); await copyFile(candidate, path.join(target, 'xslt-processor-LGPL-3.0.txt')); break; }
  catch { /* Try the other package layout. */ }
}
await access(path.join(target, 'xslt-processor-LGPL-3.0.txt'));
