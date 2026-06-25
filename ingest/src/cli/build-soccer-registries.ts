#!/usr/bin/env node
/**
 * Build published/teams/*.json for all core soccer leagues from ESPN.
 * Registry only — no vault. Run before scrape-teams for full team ingest.
 */
import { buildTeamRegistry } from '../pipeline/ingestTeams.js';

const SOCCER_REGISTRY_SPORTS = ['epl', 'laliga', 'bundesliga', 'seriea', 'ligue1', 'mls'] as const;

async function main(): Promise<void> {
  for (const sportId of SOCCER_REGISTRY_SPORTS) {
    process.stdout.write(`${sportId}… `);
    const result = await buildTeamRegistry(sportId, false);
    console.log(`✓ ${result.count} teams`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
