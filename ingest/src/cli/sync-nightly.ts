#!/usr/bin/env node
/**
 * Nightly sync — refresh season history + recent games + profile (team/position)
 * for in-season sports only. Skips legends and off-season leagues.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeManifest } from '../lib/manifest.js';
import { loadPlayerIndex } from '../lib/playerIndex.js';
import { repoPath } from '../lib/publish.js';
import { sleep } from '../lib/rateLimit.js';
import {
  sportsEligibleForNightly,
  writeSeasonStatus,
} from '../lib/seasonAwareness.js';
import { syncPlayerStats, syncPlayerProfile } from '../pipeline/syncPlayer.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let sportFilter: string | undefined;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--sport':
        sportFilter = argv[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--force':
        force = true;
        break;
      case '--help':
        console.log(`
Usage: npm run sync-nightly [-- options]

Options:
  --sport <id>   Only one sport
  --dry-run      Show what would run (season gates + player counts)
  --force        Ignore off-season gates (still skips legends)
`);
        process.exit(0);
    }
  }

  if (force) {
    const allSports = [...new Set((await loadPlayerIndex()).players.map((p) => p.sport))];
    process.env.BLOAT_FORCE_SPORTS = sportFilter ?? allSports.join(',');
  }

  const { eligible, statuses } = await sportsEligibleForNightly(
    sportFilter ? [sportFilter] : undefined,
  );
  await writeSeasonStatus(statuses);

  const index = await loadPlayerIndex();
  const candidates = index.players.filter((p) => {
    if (p.legend) return false;
    if (!eligible.includes(p.sport)) return false;
    return true;
  });

  console.log('Bloat nightly sync');
  console.log('─'.repeat(40));
  for (const s of statuses) {
    const mark = eligible.includes(s.sportId) ? '✓' : '○';
    console.log(`  ${mark} ${s.sportId}: ${s.phase} — ${s.reason}`);
  }
  console.log(`\n${candidates.length} players to check (${eligible.length} in-season sports)`);

  if (dryRun) return;

  const log: Array<Record<string, unknown>> = [];
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let skipped = 0;
  let profileUpdated = 0;

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i];
    process.stdout.write(`[${i + 1}/${candidates.length}] ${entry.sport} ${entry.name}… `);

    const statsResult = await syncPlayerStats(entry);
    const profileResult = await syncPlayerProfile(entry);
    const result = statsResult;
    log.push({ mode: 'nightly', ...result, profile: profileResult });

    if (profileResult.status === 'updated') profileUpdated++;

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

  if (updated > 0 || profileUpdated > 0) {
    const finalIndex = await loadPlayerIndex();
    await writeManifest(finalIndex);
  }

  const report = {
    ranAt: new Date().toISOString(),
    mode: 'nightly',
    eligibleSports: eligible,
    seasonStatus: statuses,
    totals: { checked: candidates.length, updated, unchanged, failed, skipped, profileUpdated },
    entries: log,
  };

  const logsDir = repoPath('ingest', 'logs');
  await mkdir(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(logsDir, `sync-nightly-${stamp}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`\n---\nDone: ${updated} stats updated, ${profileUpdated} profile updated, ${unchanged} unchanged, ${failed} failed, ${skipped} skipped`);
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
