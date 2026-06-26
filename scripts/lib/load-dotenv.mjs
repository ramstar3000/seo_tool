import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Load .env then .env.local into process.env (does not override existing). */
export function loadDotEnv(cwd = process.cwd()) {
  for (const filename of ['.env', '.env.local']) {
    const path = resolve(cwd, filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] === undefined) {
        process.env[key] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}
