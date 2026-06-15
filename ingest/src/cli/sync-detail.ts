#!/usr/bin/env node
/**
 * Bi-monthly detail sync — awards, vitals, college, headshot refresh.
 * Default: only players not synced in the last 60 days.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeManifest } from '../lib/manifest.js';
import { loadPlayerIndex } from '../lib/playerIndex.js';
import { repoPath } from '../lib/publish.js';
import { sleep } from '../lib/rateLimit.js';
import { getAllSportSeasonStatuses, writeSeasonStatus } from '../lib/seasonAwareness.js';
import { isDetailSyncDue, syncPlayerDetail } from '../pipeline/syncPlayer.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let sportFilter: string | undefined;
  let dryRun = false;
  let forceAll = false;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--sport':
        sportFilter = argv[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--force':
        forceAll = true;
        break;
      case '--help':
        console.log(`
Usage: npm run sync-detail [-- options]

Options:
  --sport <id>   Only one sport
  --dry-run      Preview counts (due vs skipped)
  --force        Sync all ingested players (ignore 60-day window)
`);
        process.exit(0);
    }
  }

  const statuses = await getAllSportSeasonStatuses();
  await writeSeasonStatus(statuses);

  const index = await loadPlayerIndex();
  const candidates = index.players.filter((p) => {
    if (sportFilter && p.sport !== sportFilter) return false;
    if (forceAll) return true;
    return isDetailSyncDue(p);
  });

  const skippedRecent = index.players.length - candidates.length;

  console.log('Bloat detail sync (bi-monthly)');
  console.log('─'.repeat(40));
  console.log(`${candidates.length} players due (${skippedRecent} synced within 60 days)`);

  if (dryRun) return;

  const log: Array<Record<string, unknown>> = [];
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i];
    process.stdout.write(`[${i + 1}/${candidates.length}] ${entry.sport} ${entry.name}… `);

    const result = await syncPlayerDetail(entry);
    log.push({ mode: 'detail', ...result });

    switch (result.status) {
      case 'updated':
        updated++;
        console.log(`✓ ${result.changes?.join(', ') ?? 'updated'}`);
        break;
      case 'unchanged':
        unchanged++;
        console.log('· unchanged');
        break;
      case 'skipped':
        skipped++;
        console.log(`○ ${result.detail}`);
        break;
      default:
        failed++;
        console.log(`✗ ${result.detail}`);
    }

    await sleep(350);
  }

  if (updated > 0) {
    const finalIndex = await loadPlayerIndex();
    await writeManifest(finalIndex);
  }

  const report = {
    ranAt: new Date().toISOString(),
    mode: 'detail',
    totals: { checked: candidates.length, updated, unchanged, failed, skipped, skippedRecent },
    entries: log,
  };

  const logsDir = repoPath('ingest', 'logs');
  await mkdir(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(logsDir, `sync-detail-${stamp}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`\n---\nDone: ${updated} updated, ${unchanged} unchanged, ${failed} failed, ${skipped} skipped`);
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
