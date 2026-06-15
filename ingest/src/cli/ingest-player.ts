#!/usr/bin/env node
/**
 * Ingest a single player's career season history.
 *
 * Examples:
 *   npm run ingest -- --sport nba --espn 1966
 *   npm run ingest -- --sport nba --name "LeBron James"
 *   npm run ingest -- --sport nfl --name "Patrick Mahomes" --source sportsref
 *   npm run ingest -- --sport mlb --espn 33192 --source auto
 */

import { ingestPlayer, type IngestSource } from '../pipeline/ingestPlayer.js';

function usage(): never {
  console.error(`
Usage: npm run ingest -- --sport <id> (--espn <id> | --name "Player Name") [options]

Sports:  nba, wnba, nfl, mlb, nhl, mls, epl
Options:
  --source <espn|sportsref|auto>   Data source (default: auto — ESPN first, then sports-ref)
  --slug <sports-ref-slug>         Override slug (e.g. jamesle01, BradyTo00)
  --position <POS>                 Helps NFL/MLB/NHL pick correct stat table
`);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  sport?: string;
  espnId?: string;
  name?: string;
  slug?: string;
  position?: string;
  source?: IngestSource;
  skipHeadshot?: boolean;
  forceHeadshot?: boolean;
} {
  const out: ReturnType<typeof parseArgs> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--sport':
        out.sport = next;
        i++;
        break;
      case '--espn':
        out.espnId = next;
        i++;
        break;
      case '--name':
        out.name = next;
        i++;
        break;
      case '--slug':
        out.slug = next;
        i++;
        break;
      case '--position':
        out.position = next;
        i++;
        break;
      case '--source':
        out.source = next as IngestSource;
        i++;
        break;
      case '--skip-headshot':
        out.skipHeadshot = true;
        break;
      case '--force-headshot':
        out.forceHeadshot = true;
        break;
      case '--help':
      case '-h':
        usage();
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.sport || (!args.espnId && !args.name)) usage();

  console.log(`Ingesting ${args.name ?? args.espnId} (${args.sport})…`);

  const result = await ingestPlayer({
    sportId: args.sport,
    espnId: args.espnId,
    name: args.name,
    slug: args.slug,
    position: args.position,
    source: args.source,
    skipHeadshot: args.skipHeadshot,
    forceHeadshot: args.forceHeadshot,
  });

  if (!result.ok) {
    console.error(result.error ?? 'Ingest failed');
    process.exit(1);
  }

  console.log('Done.');
  console.log(`  Player:    ${result.name} (ESPN ${result.espnId ?? '—'})`);
  console.log(`  Slug:      ${result.slug}`);
  console.log(`  Rows:      ${result.rowCount}`);
  console.log(`  Sources:   ${result.sources.join(', ')}`);
  if (result.headshotPath) console.log(`  Headshot:  ${result.headshotPath}`);
  console.log(`  Published: ${result.publishedPath}`);
  console.log(`  Vault:     ${result.vaultPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
