#!/usr/bin/env node
/**
 * Fetch ESPN team metadata and write vault snapshot (foundation for team historical data).
 *
 * Example:
 *   npm run ingest-team -- --sport nba --abbr LAL
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchEspnTeamRoster, fetchEspnTeams } from '../sources/espn/fetch.js';
import { getSport } from '../sources/espn/config.js';
import { repoPath } from '../lib/publish.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let sportId: string | undefined;
  let abbr: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sport') sportId = argv[++i];
    if (argv[i] === '--abbr') abbr = argv[++i]?.toUpperCase();
  }

  if (!sportId || !abbr) {
    console.error('Usage: npm run ingest-team -- --sport nba --abbr LAL');
    process.exit(1);
  }

  const sport = getSport(sportId);
  const teams = await fetchEspnTeams(sport);
  const team = teams.find((t) => t.abbr.toUpperCase() === abbr);
  if (!team) throw new Error(`Unknown team abbr: ${abbr}`);

  const roster = await fetchEspnTeamRoster(sport, team.id);
  const record = {
    id: team.id,
    abbr: team.abbr,
    name: team.name,
    sport: sport.id,
    roster,
    ingestedAt: new Date().toISOString(),
    source: 'espn',
  };

  const outPath = repoPath('vault', sport.id, 'teams', `${team.abbr.toLowerCase()}.json`);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${outPath} (${roster.length} players)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
