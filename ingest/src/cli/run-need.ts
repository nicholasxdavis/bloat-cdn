#!/usr/bin/env node
/**
 * Automated batch scrape from need.json.
 * Skips failures, resumes already-indexed players, writes manifest + player-index.
 *
 * Examples:
 *   npm run scrape
 *   npm run scrape -- --sport nba
 *   npm run scrape -- --legends
 *   npm run scrape -- --force
 *   npm run scrape -- --dry-run
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeManifest } from '../lib/manifest.js';
import { filterNeedList, loadNeedList } from '../lib/needList.js';
import { isPlayerIndexed, loadPlayerIndex } from '../lib/playerIndex.js';
import { cdnVaultPath, repoPath } from '../lib/publish.js';
import { sleep } from '../lib/rateLimit.js';
import { ingestPlayer } from '../pipeline/ingestPlayer.js';

interface BatchEntry {
  sport: string;
  name: string;
  legend: boolean;
  status: 'ok' | 'skipped' | 'failed';
  detail?: string;
  slug?: string;
  rows?: number;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let sportFilter: string | undefined;
  let legendsOnly = false;
  let currentOnly = false;
  let force = false;
  let dryRun = false;
  let needFile: string | undefined;
  let limit = Infinity;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--sport':
        sportFilter = argv[++i];
        break;
      case '--legends':
        legendsOnly = true;
        break;
      case '--current':
        currentOnly = true;
        break;
      case '--force':
        force = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--need':
        needFile = argv[++i];
        break;
      case '--limit':
        limit = Number(argv[++i]);
        break;
      case '--help':
        console.log(`
Usage: npm run scrape [-- options]

Options:
  --sport <id>     Only run one sport (nba, nfl, fights, …)
  --legends        Only legends block from need.json
  --current        Only current (non-legend) players
  --force          Re-ingest even if already in player-index
  --dry-run        List work items without fetching
  --limit <n>      Max players to process
  --need <path>    Alternate need.json path
`);
        process.exit(0);
    }
  }

  const all = filterNeedList(await loadNeedList(needFile), {
    sport: sportFilter,
    legendsOnly,
    currentOnly,
  });

  const index = await loadPlayerIndex();
  const toRun = (force
    ? all
    : all.filter((p) => !isPlayerIndexed(index, p.sportId, p.name, p.legend))
  ).slice(0, limit);

  const skippedResume = force ? 0 : all.length - toRun.length;
  console.log(
    `Bloat scrape: ${toRun.length} to run (${all.length} in need.json${skippedResume ? `, ${skippedResume} already indexed` : ''})`,
  );
  if (dryRun) {
    for (const p of toRun) {
      console.log(`  [${p.legend ? 'legend' : 'current'}] ${p.sportId}: ${p.name}`);
    }
    return;
  }

  const log: BatchEntry[] = [];
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < toRun.length; i++) {
    const item = toRun[i];
    const label = `[${i + 1}/${toRun.length}] ${item.sportId} ${item.name}`;
    process.stdout.write(`${label}… `);

    const result = await ingestPlayer({
      sportId: item.sportId,
      name: item.name,
      legend: item.legend,
      skipIndex: true,
      forceHeadshot: force,
    });

    if (result.ok) {
      ok++;
      console.log(`✓ ${result.rowCount} seasons${result.headshotPath ? ' + headshot' : ''}`);
      log.push({
        sport: item.sportId,
        name: item.name,
        legend: item.legend,
        status: 'ok',
        slug: result.slug,
        rows: result.rowCount,
      });

      const { upsertPlayerIndex } = await import('../lib/playerIndex.js');
      await upsertPlayerIndex({
        sport: item.sportId,
        name: result.name,
        slug: result.slug,
        espnId: result.espnId,
        legend: item.legend,
        headshot: result.headshotPath,
        statsPath: result.statsPath,
        vaultPath: cdnVaultPath(item.sportId, result.name),
        rowCount: result.rowCount,
        sources: result.sources,
        ingestedAt: new Date().toISOString(),
      });
    } else {
      failed++;
      console.log(`✗ ${result.error ?? 'failed'}`);
      log.push({
        sport: item.sportId,
        name: item.name,
        legend: item.legend,
        status: 'failed',
        detail: result.error,
      });
    }

    await sleep(300);
  }

  const finalIndex = await loadPlayerIndex();
  const manifest = await writeManifest(finalIndex);

  const report = {
    ranAt: new Date().toISOString(),
    totals: { ok, failed, skipped: skippedResume, queued: toRun.length },
    manifest,
    entries: log,
  };

  const logsDir = repoPath('ingest', 'logs');
  await mkdir(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(logsDir, `batch-${stamp}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('\n---');
  console.log(`Done: ${ok} ok, ${failed} failed${skippedResume ? `, ${skippedResume} resumed` : ''}`);
  console.log(`Manifest: ${manifest.sports.length} sports, ${finalIndex.players.length} indexed players`);
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
