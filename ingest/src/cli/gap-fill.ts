#!/usr/bin/env node
/**
 * One-shot gap fill: team registries (+ logos), player scrape, team vaults, manifest.
 *
 *   npm run gap-fill
 *   npm run gap-fill -- --registries-only
 *   npm run gap-fill -- --players-only
 *   npm run gap-fill -- --teams-only
 *   npm run gap-fill -- --skip-players --skip-teams
 */
import { buildTeamRegistry } from '../pipeline/ingestTeams.js';
import { filterNeedList, loadNeedList } from '../lib/needList.js';
import { filterNeedTeamList, loadNeedTeamList } from '../lib/needTeamList.js';
import { isPlayerIndexed, loadPlayerIndex, upsertPlayerIndex } from '../lib/playerIndex.js';
import { isTeamIndexed, loadTeamIndex, upsertTeamIndex } from '../lib/teamIndex.js';
import { writeManifestFromTeamIndex } from '../lib/manifest.js';
import { cdnVaultPath } from '../lib/publish.js';
import { sleep } from '../lib/rateLimit.js';
import { ingestPlayer } from '../pipeline/ingestPlayer.js';
import { ingestTeam } from '../pipeline/ingestTeams.js';
import { getSport } from '../sources/espn/config.js';
import { fetchEspnLeagueTeams, type EspnTeamRaw } from '../sources/espn/teams.js';

const REGISTRY_SPORTS = [
  'nba', 'wnba', 'nfl', 'mlb', 'nhl',
  'epl', 'laliga', 'bundesliga', 'seriea', 'ligue1', 'mls',
  'ucl', 'europa', 'ligamx', 'brasileirao', 'eredivisie', 'championship', 'primeira',
] as const;

async function buildAllRegistries(forceLogos: boolean): Promise<void> {
  console.log('\n=== Team registries ===');
  for (const sportId of REGISTRY_SPORTS) {
    try {
      process.stdout.write(`  ${sportId}… `);
      const result = await buildTeamRegistry(sportId, forceLogos);
      console.log(`✓ ${result.count} teams`);
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : err}`);
    }
    await sleep(200);
  }
}

async function scrapePlayers(force: boolean): Promise<{ ok: number; failed: number }> {
  console.log('\n=== Player scrape (need.json) ===');
  const all = await loadNeedList();
  const index = await loadPlayerIndex();
  const toRun = force ? all : all.filter((p) => !isPlayerIndexed(index, p.sportId, p.name, p.legend));

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < toRun.length; i++) {
    const item = toRun[i];
    process.stdout.write(`  [${i + 1}/${toRun.length}] [${item.sportId}] ${item.name}… `);
    const result = await ingestPlayer({
      sportId: item.sportId,
      name: item.name,
      legend: item.legend,
      skipIndex: true,
      forceHeadshot: force,
    });
    if (result.ok) {
      ok++;
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
      console.log(`✓ ${result.rowCount ?? 0} seasons`);
    } else {
      failed++;
      console.log(`✗ ${result.error ?? 'failed'}`);
    }
    await sleep(450);
  }

  return { ok, failed };
}

async function scrapeTeamVaults(force: boolean): Promise<{ ok: number; failed: number }> {
  console.log('\n=== Team vaults (need-team.json) ===');
  const all = await loadNeedTeamList();
  const index = await loadTeamIndex();
  const toRun = force ? all : all.filter((t) => !isTeamIndexed(index, t.sportId, t.name));

  const bySport = new Map<string, typeof toRun>();
  for (const item of toRun) {
    const list = bySport.get(item.sportId) ?? [];
    list.push(item);
    bySport.set(item.sportId, list);
  }

  let ok = 0;
  let failed = 0;

  for (const [sportId, items] of bySport) {
    console.log(`\n  ${sportId.toUpperCase()} (${items.length} teams)`);
    try {
      await buildTeamRegistry(sportId, false);
    } catch {
      /* registry may already exist */
    }

    let leagueTeams: EspnTeamRaw[] = [];
    try {
      leagueTeams = await fetchEspnLeagueTeams(getSport(sportId));
    } catch {
      /* fall back to empty — ingestTeam may still resolve via index */
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      process.stdout.write(`    [${i + 1}/${items.length}] ${item.name}… `);
      const result = await ingestTeam(item, { leagueTeams, forceLogo: force });
      if (result.ok && result.indexEntry) {
        ok++;
        await upsertTeamIndex(result.indexEntry);
        console.log(`✓ ${result.abbr}`);
      } else {
        failed++;
        console.log(`✗ ${result.error ?? 'failed'}`);
      }
      await sleep(400);
    }
  }

  return { ok, failed };
}

async function rebuildManifest(): Promise<void> {
  console.log('\n=== Manifest ===');
  const [players, teams] = await Promise.all([loadPlayerIndex(), loadTeamIndex()]);
  const manifest = await writeManifestFromTeamIndex(teams, players);
  for (const s of manifest.sports) {
    console.log(`  ${s.sport}: ${s.players} players, ${s.teams} teams, ${s.headshots} headshots`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const registriesOnly = argv.includes('--registries-only');
  const playersOnly = argv.includes('--players-only');
  const teamsOnly = argv.includes('--teams-only');
  const skipPlayers = argv.includes('--skip-players');
  const skipTeams = argv.includes('--skip-teams');
  const force = argv.includes('--force');

  const doRegistries = registriesOnly || (!playersOnly && !teamsOnly);
  const doPlayers = playersOnly || (!registriesOnly && !teamsOnly && !skipPlayers);
  const doTeams = teamsOnly || (!registriesOnly && !playersOnly && !skipTeams);
  const doManifest = !registriesOnly || playersOnly || teamsOnly || argv.includes('--manifest');

  if (doRegistries) await buildAllRegistries(force);
  if (doPlayers) {
    const p = await scrapePlayers(force);
    console.log(`\nPlayers: ${p.ok} ok, ${p.failed} failed`);
  }
  if (doTeams) {
    const t = await scrapeTeamVaults(force);
    console.log(`\nTeams: ${t.ok} ok, ${t.failed} failed`);
  }
  if (doManifest) await rebuildManifest();
  console.log('\nGap fill complete.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
