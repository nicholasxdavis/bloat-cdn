#!/usr/bin/env node
/**
 * Weekly sync — refresh player profile (team, position, active status).
 * Runs for all ingested players regardless of season.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeManifest } from '../lib/manifest.js';
import { loadPlayerIndex } from '../lib/playerIndex.js';
import { repoPath } from '../lib/publish.js';
import { sleep } from '../lib/rateLimit.js';
import { getAllSportSeasonStatuses, writeSeasonStatus } from '../lib/seasonAwareness.js';
import { syncPlayerProfile } from '../pipeline/syncPlayer.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let sportFilter: string | undefined;
  let dryRun = false;
  let currentOnly = false;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--sport':
        sportFilter = argv[++i];
        break;
      case '--current':
        currentOnly = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--help':
        console.log(`
Usage: npm run sync-weekly [-- options]

Options:
  --sport <id>   Only one sport
  --current      Skip legends (active roster checks only)
  --dry-run      Preview counts
`);
        process.exit(0);
    }
  }

  const statuses = await getAllSportSeasonStatuses();
  await writeSeasonStatus(statuses);

  const index = await loadPlayerIndex();
  const candidates = index.players.filter((p) => {
    if (sportFilter && p.sport !== sportFilter) return false;
    if (currentOnly && p.legend) return false;
    return true;
  });

  console.log(`Bloat weekly profile sync: ${candidates.length} players`);
  if (dryRun) return;

  const log: Array<Record<string, unknown>> = [];
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i];
    process.stdout.write(`[${i + 1}/${candidates.length}] ${entry.sport} ${entry.name}… `);

    const result = await syncPlayerProfile(entry);
    log.push({ mode: 'weekly', ...result });

    switch (result.status) {
      case 'updated':
        updated++;
        console.log(`✓ ${result.changes?.join(', ') ?? 'updated'}`);
        break;
      case 'unchanged':
        unchanged++;
        console.log('· unchanged');
        break;
      default:
        failed++;
        console.log(`✗ ${result.detail ?? result.status}`);
    }

    await sleep(350);
  }

  if (updated > 0) {
    const finalIndex = await loadPlayerIndex();
    await writeManifest(finalIndex);
  }

  const report = {
    ranAt: new Date().toISOString(),
    mode: 'weekly',
    totals: { checked: candidates.length, updated, unchanged, failed },
    entries: log,
  };

  const logsDir = repoPath('ingest', 'logs');
  await mkdir(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(logsDir, `sync-weekly-${stamp}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`\n---\nDone: ${updated} updated, ${unchanged} unchanged, ${failed} failed`);
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
