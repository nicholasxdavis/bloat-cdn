#!/usr/bin/env node
/**
 * Smart sync — Sunday: weekly profile; other days: nightly stats (season-aware).
 * Use --mode to override.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const INGEST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function runCli(script: string, args: string[]): void {
  const cmd = `npx tsx src/cli/${script} ${args.map((a) => JSON.stringify(a)).join(' ')}`;
  execSync(cmd, { stdio: 'inherit', cwd: INGEST_ROOT, env: process.env });
}

type SyncMode = 'auto' | 'weekly' | 'nightly' | 'detail' | 'both';

function parseMode(raw: string | undefined): SyncMode {
  if (raw === 'weekly' || raw === 'nightly' || raw === 'detail' || raw === 'both') return raw;
  return 'auto';
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let mode: SyncMode = 'auto';
  const passthrough: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode') {
      mode = parseMode(argv[++i]);
      continue;
    }
    passthrough.push(argv[i]);
  }

  if (passthrough.includes('--help')) {
    console.log(`
Usage: npm run sync [-- options]

  --mode auto     Sunday → weekly; Mon–Sat → nightly (default)
  --mode weekly   Profile sync (team, position, active)
  --mode nightly  Stats sync (season-aware, in-season only)
  --mode detail   Bi-monthly awards / vitals / headshots
  --mode both     Weekly then nightly

Also accepts --dry-run, --sport <id>, --force, --current (weekly).
`);
    return;
  }

  const isSunday = new Date().getUTCDay() === 0;
  const isDetailDay = new Date().getUTCDate() === 1 && [0, 2, 4, 6, 8, 10].includes(new Date().getUTCMonth());
  const runWeekly = mode === 'weekly' || mode === 'both' || (mode === 'auto' && isSunday);
  const runNightly = mode === 'nightly' || mode === 'both' || (mode === 'auto' && !isSunday && !isDetailDay);
  const runDetail = mode === 'detail' || (mode === 'auto' && isDetailDay);

  if (runWeekly) {
    console.log('→ Weekly profile sync\n');
    runCli('sync-weekly.ts', passthrough);
  }

  if (runDetail) {
    console.log('\n→ Bi-monthly detail sync\n');
    runCli('sync-detail.ts', passthrough);
  }

  if (runNightly) {
    console.log('\n→ Nightly stats sync\n');
    runCli('sync-nightly.ts', passthrough);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
