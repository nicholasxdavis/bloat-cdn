#!/usr/bin/env node
/**
 * Ingest the 5 starting players for every NBA team (150 players total).
 * Fetches the official ESPN depth chart for each team.
 *
 * Example:
 *   npm run scrape-nba-starters
 *   npm run scrape-nba-starters -- --limit 1
 */

import { fetchEspnTeams } from '../sources/espn/fetch.js';
import { getSport } from '../sources/espn/config.js';
import { ingestPlayer } from '../pipeline/ingestPlayer.js';
import { sleep } from '../lib/rateLimit.js';

function usage(): never {
  console.error(`
Usage: npm run scrape-nba-starters [options]

Options:
  --limit <n>       Max teams to scrape depth charts for (default: all 30)
  --source <auto>   espn | sportsref | auto
`);
  process.exit(1);
}

async function fetchTeamStarters(abbr: string): Promise<Array<{ id: string; name: string }>> {
  const url = `https://www.espn.com/nba/team/depth/_/name/${abbr.toLowerCase()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch depth chart for ${abbr}: ${res.status}`);
  const text = await res.text();

  const match = text.match(/window\['__espnfitt__'\]\s*=\s*({.*?});/s);
  if (!match) throw new Error(`Could not find __espnfitt__ in HTML for ${abbr}`);

  const state = JSON.parse(match[1]);
  const depth = state?.page?.content?.depth;
  if (!depth?.dethTeamGroups?.[0]?.rows) {
    throw new Error(`Missing depthTeamGroups in state for ${abbr}`);
  }

  const starters: Array<{ id: string; name: string }> = [];
  const rows = depth.dethTeamGroups[0].rows;

  // Each row corresponds to a position. The first player is the starter.
  for (const row of rows) {
    // row is an array, e.g. ["PG", { name: "Player", uid: "..." }, ...]
    if (Array.isArray(row) && row.length > 1) {
      const starter = row[1];
      if (starter?.uid) {
        // uid format: "s:40~l:46~a:4278053"
        const idMatch = starter.uid.match(/a:(\d+)/);
        const espnId = idMatch ? idMatch[1] : starter.uid;
        starters.push({ id: espnId, name: starter.name });
      } else if (starter?.name) {
        starters.push({ id: '', name: starter.name });
      }
    }
  }

  return starters;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let limit = Infinity;
  let source: 'espn' | 'sportsref' | 'auto' | undefined;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
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

  const sport = getSport('nba');
  console.log('Fetching NBA teams...');
  const teams = await fetchEspnTeams(sport);
  const slice = teams.slice(0, limit);

  console.log(`Found ${teams.length} teams. Processing ${slice.length} teams...`);

  let ok = 0;
  let fail = 0;

  for (const team of slice) {
    console.log(`\nFetching starters for ${team.name} (${team.abbr})...`);
    try {
      const starters = await fetchTeamStarters(team.abbr);
      if (starters.length === 0) {
        console.warn(`  ! No starters found for ${team.abbr}`);
        continue;
      }
      
      for (const player of starters) {
        const result = await ingestPlayer({
          sportId: sport.id,
          espnId: player.id || undefined,
          name: player.name,
          source,
        });

        if (result.ok) {
          ok++;
          console.log(`  ✓ ${result.name} (${result.rowCount} seasons)`);
        } else {
          fail++;
          console.warn(`  ✗ ${player.name}: ${result.error ?? 'failed'}`);
        }
        await sleep(500); // Respect rate limits
      }
    } catch (err) {
      console.error(`  ✗ Error fetching ${team.name}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nFinished: ${ok} starters ok, ${fail} failed`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
