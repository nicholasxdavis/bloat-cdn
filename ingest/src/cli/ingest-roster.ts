#!/usr/bin/env node
/**
 * Ingest every player on an ESPN team roster.
 *
 * Examples:
 *   npm run ingest-roster -- --sport nba --team 13
 *   npm run ingest-roster -- --sport nba --abbr LAL
 *   npm run ingest-roster -- --sport nba --abbr LAL --limit 5
 */

import { fetchEspnTeams, fetchEspnTeamRoster } from '../sources/espn/fetch.js';
import { getSport } from '../sources/espn/config.js';
import { ingestPlayer } from '../pipeline/ingestPlayer.js';
import { sleep } from '../lib/rateLimit.js';

function usage(): never {
  console.error(`
Usage: npm run ingest-roster -- --sport <id> (--team <espnTeamId> | --abbr <ABBR>) [options]

Options:
  --limit <n>       Max players to ingest (default: all)
  --source <auto>   espn | sportsref | auto
  --skip-existing   Skip if published file already exists (not implemented yet — logs only)
`);
  process.exit(1);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let sportId: string | undefined;
  let teamId: string | undefined;
  let abbr: string | undefined;
  let limit = Infinity;
  let source: 'espn' | 'sportsref' | 'auto' | undefined;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--sport':
        sportId = argv[++i];
        break;
      case '--team':
        teamId = argv[++i];
        break;
      case '--abbr':
        abbr = argv[++i]?.toUpperCase();
        break;
      case '--limit':
        limit = Number(argv[++i]);
        break;
      case '--source':
        source = argv[++i] as typeof source;
        break;
      case '--help':
        usage();
    }
  }

  if (!sportId || (!teamId && !abbr)) usage();

  const sport = getSport(sportId);

  if (!teamId && abbr) {
    const teams = await fetchEspnTeams(sport);
    const match = teams.find((t) => t.abbr.toUpperCase() === abbr);
    if (!match) throw new Error(`No ESPN team with abbr ${abbr}`);
    teamId = match.id;
    console.log(`Resolved ${abbr} → team id ${teamId} (${match.name})`);
  }

  const roster = await fetchEspnTeamRoster(sport, teamId!);
  const slice = roster.slice(0, limit);
  console.log(`Roster: ${slice.length} players`);

  let ok = 0;
  let fail = 0;

  for (const player of slice) {
    const result = await ingestPlayer({
      sportId: sport.id,
      espnId: player.id,
      name: player.name,
      position: player.position,
      source,
    });
    if (result.ok) {
      ok++;
      console.log(`  ✓ ${result.name} (${result.rowCount} seasons)`);
    } else {
      fail++;
      console.warn(`  ✗ ${player.name}: ${result.error ?? 'failed'}`);
    }
    await sleep(500);
  }

  console.log(`Finished: ${ok} ok, ${fail} failed`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
