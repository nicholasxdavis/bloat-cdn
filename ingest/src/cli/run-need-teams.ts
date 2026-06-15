#!/usr/bin/env node
/**
 * Batch ingest teams from need-team.json.
 *
 * Examples:
 *   npm run scrape-teams
 *   npm run scrape-teams -- --sport nba
 *   npm run scrape-teams -- --registry-only
 *   npm run scrape-teams -- --force
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { filterNeedTeamList, loadNeedTeamList } from '../lib/needTeamList.js';
import { isTeamIndexed, loadTeamIndex, upsertTeamIndex } from '../lib/teamIndex.js';
import { writeManifestFromTeamIndex } from '../lib/manifest.js';
import { repoPath } from '../lib/publish.js';
import { sleep } from '../lib/rateLimit.js';
import { buildTeamRegistry, ingestTeam } from '../pipeline/ingestTeams.js';
import { getSport } from '../sources/espn/config.js';
import { fetchEspnLeagueTeams } from '../sources/espn/teams.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let sportFilter: string | undefined;
  let force = false;
  let registryOnly = false;
  let dryRun = false;
  let needFile: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--sport':
        sportFilter = argv[++i];
        break;
      case '--force':
        force = true;
        break;
      case '--registry-only':
        registryOnly = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--need':
        needFile = argv[++i];
        break;
      case '--help':
        console.log(`
Usage: npm run scrape-teams [-- options]

Options:
  --sport <id>       nba, nfl, mlb, nhl, mls
  --registry-only    Build published/teams/*.json only (no vault)
  --force            Re-ingest indexed teams
  --dry-run          Preview queue
  --need <path>      Alternate need-team.json
`);
        process.exit(0);
    }
  }

  const all = filterNeedTeamList(await loadNeedTeamList(needFile), { sport: sportFilter });
  const index = await loadTeamIndex();
  const toRun = force ? all : all.filter((t) => !isTeamIndexed(index, t.sportId, t.name));

  console.log(
    `Bloat team scrape: ${toRun.length} to run (${all.length} in need-team.json${!force && all.length > toRun.length ? `, ${all.length - toRun.length} already indexed` : ''})`,
  );

  if (dryRun) {
    for (const t of toRun) {
      console.log(`  [${t.sportId}] ${t.name}${t.tier ? ` (${t.tier})` : ''}`);
    }
    return;
  }

  // Group by sport — one registry build per sport, then vault each team
  const bySport = new Map<string, typeof toRun>();
  for (const item of toRun) {
    const list = bySport.get(item.sportId) ?? [];
    list.push(item);
    bySport.set(item.sportId, list);
  }

  if (registryOnly) {
    for (const sportId of bySport.keys()) {
      const result = await buildTeamRegistry(sportId, force);
      console.log(`  ✓ ${sportId} registry → ${result.count} teams`);
    }
    return;
  }

  let ok = 0;
  let failed = 0;
  const log: Array<{ sport: string; name: string; status: string; detail?: string }> = [];

  for (const [sportId, items] of bySport) {
    console.log(`\n${sportId.toUpperCase()} (${items.length} teams)`);
    await buildTeamRegistry(sportId, force);

    const sport = getSport(sportId);
    const leagueTeams = await fetchEspnLeagueTeams(sport);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      process.stdout.write(`  [${i + 1}/${items.length}] ${item.name}… `);

      const result = await ingestTeam(item, { leagueTeams, forceLogo: force });
      if (result.ok && result.indexEntry) {
        ok++;
        await upsertTeamIndex(result.indexEntry);
        console.log(`✓ ${result.abbr}${result.vaultPath ? ' + vault' : ''}`);
        log.push({ sport: sportId, name: item.name, status: 'ok' });
      } else {
        failed++;
        console.log(`✗ ${result.error ?? 'failed'}`);
        log.push({ sport: sportId, name: item.name, status: 'failed', detail: result.error });
      }
      await sleep(400);
    }
  }

  const finalIndex = await loadTeamIndex();
  await writeManifestFromTeamIndex(finalIndex);
  const report = {
    ranAt: new Date().toISOString(),
    totals: { ok, failed, queued: toRun.length },
    indexedTeams: finalIndex.teams.length,
    entries: log,
  };

  const logsDir = repoPath('ingest', 'logs');
  await mkdir(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(logsDir, `teams-batch-${stamp}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`\n---\nDone: ${ok} ok, ${failed} failed`);
  console.log(`Team index: ${finalIndex.teams.length} teams`);
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
