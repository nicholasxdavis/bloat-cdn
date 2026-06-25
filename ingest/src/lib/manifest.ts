import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { PlayerIndex } from './playerIndex.js';
import type { TeamIndex } from '../types/team.js';
import { loadTeamIndex } from './teamIndex.js';
import { repoPath } from './publish.js';

export interface BloatManifest {
  version: number;
  syncedAt: string;
  playerIndexVersion: number;
  teamIndexVersion: number;
  sports: Array<{
    sport: string;
    players: number;
    legends: number;
    headshots: number;
    teams: number;
    statsPrefix?: string;
  }>;
}

const MANIFEST_PATH = () => repoPath('published', 'meta', 'manifest.json');

const STATS_PREFIX: Record<string, string> = {
  nba: 'bbref',
  wnba: 'bbref',
  nfl: 'pfr',
  mlb: 'bref',
  nhl: 'href',
  mls: 'fbref',
  epl: 'fbref',
  laliga: 'fbref',
  bundesliga: 'fbref',
  seriea: 'fbref',
  ligue1: 'fbref',
  ucl: 'fbref',
  europa: 'fbref',
  ligamx: 'fbref',
  brasileirao: 'fbref',
  eredivisie: 'fbref',
  championship: 'fbref',
  primeira: 'fbref',
  fights: 'espn-mma',
  tennis: 'espn-tennis',
  golf: 'espn-golf',
};

export function buildManifest(playerIndex: PlayerIndex, teamIndex: TeamIndex): BloatManifest {
  const bySport = new Map<string, { players: number; legends: number; headshots: number; teams: number }>();

  for (const p of playerIndex.players) {
    const bucket = bySport.get(p.sport) ?? { players: 0, legends: 0, headshots: 0, teams: 0 };
    bucket.players += 1;
    if (p.legend) bucket.legends += 1;
    if (p.headshot?.startsWith('media/')) bucket.headshots += 1;
    bySport.set(p.sport, bucket);
  }

  for (const t of teamIndex.teams) {
    const bucket = bySport.get(t.sport) ?? { players: 0, legends: 0, headshots: 0, teams: 0 };
    bucket.teams += 1;
    bySport.set(t.sport, bucket);
  }

  const sports = [...bySport.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sport, counts]) => ({
      sport,
      ...counts,
      statsPrefix: STATS_PREFIX[sport],
    }));

  return {
    version: 1,
    syncedAt: new Date().toISOString(),
    playerIndexVersion: playerIndex.version,
    teamIndexVersion: teamIndex.version,
    sports,
  };
}

export async function writeManifest(playerIndex: PlayerIndex): Promise<BloatManifest> {
  const teamIndex = await loadTeamIndex();
  const manifest = buildManifest(playerIndex, teamIndex);
  await mkdir(path.dirname(MANIFEST_PATH()), { recursive: true });
  await writeFile(MANIFEST_PATH(), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export async function writeManifestFromTeamIndex(teamIndex: TeamIndex, playerIndex?: PlayerIndex): Promise<BloatManifest> {
  const { loadPlayerIndex } = await import('./playerIndex.js');
  const players = playerIndex ?? (await loadPlayerIndex());
  const manifest = buildManifest(players, teamIndex);
  await mkdir(path.dirname(MANIFEST_PATH()), { recursive: true });
  await writeFile(MANIFEST_PATH(), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}
