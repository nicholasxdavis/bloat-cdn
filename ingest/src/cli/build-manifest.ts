#!/usr/bin/env node
/**
 * Rebuild published/meta/manifest.json from player + team indexes.
 * Run after ingest without re-scraping.
 */

import { loadPlayerIndex } from '../lib/playerIndex.js';
import { loadTeamIndex } from '../lib/teamIndex.js';
import { writeManifestFromTeamIndex } from '../lib/manifest.js';

async function main(): Promise<void> {
  const [players, teams] = await Promise.all([loadPlayerIndex(), loadTeamIndex()]);
  const manifest = await writeManifestFromTeamIndex(teams, players);

  console.log(`Manifest rebuilt: ${manifest.sports.length} sports`);
  for (const s of manifest.sports) {
    console.log(
      `  ${s.sport}: ${s.players} players (${s.legends} legends), ${s.teams} teams, ${s.headshots} headshots`,
    );
  }
  console.log(`Synced: ${manifest.syncedAt}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
