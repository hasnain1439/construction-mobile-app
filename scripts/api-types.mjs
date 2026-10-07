// Generates src/api/schema.ts from the backend's OpenAPI document (the API must be running).
// Usage: npm run api:types   — reads EXPO_PUBLIC_API_BASE_URL from .env (…/api/v1 → …/api/docs.json).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const env = existsSync('.env') ? Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const base = (process.env.EXPO_PUBLIC_API_BASE_URL ?? env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1')
  .replace(/\/api\/v1\/?$/, '')
  // 10.0.2.2 is the Android emulator's name for this PC; from the PC itself it is localhost.
  .replace('//10.0.2.2', '//localhost');
const source = `${base}/api/docs.json`;
console.log(`openapi-typescript ${source} → src/api/schema.ts`);
execFileSync(process.execPath, ['node_modules/openapi-typescript/bin/cli.js', source, '-o', 'src/api/schema.ts'], { stdio: 'inherit' });
