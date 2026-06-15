import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CdnStatsPrefix, PlayerDetails, PlayerGameLogRow, PlayerSeasonRow, PlayerVault } from '../types/siyf.js';
import { nameToVaultSlug } from './slug.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function repoPath(...segments: string[]): string {
  return path.join(REPO_ROOT, ...segments);
}

/** Engine-ready: `published/stats/bbref/jamesle01.json` */
export function publishedStatsPath(prefix: CdnStatsPrefix, slug: string): string {
  return repoPath('published', 'stats', prefix, `${slug.toLowerCase()}.json`);
}

/** CDN-relative stats path (what the engine fetches). */
export function cdnStatsPath(prefix: CdnStatsPrefix, slug: string): string {
  return `stats/${prefix}/${slug.toLowerCase()}.json`;
}

/** Rich internal vault: `vault/nba/players/lebron-james.json` */
export function vaultPlayerPath(sportId: string, name: string): string {
  return repoPath('vault', sportId, 'players', `${nameToVaultSlug(name)}.json`);
}

export function cdnVaultPath(sportId: string, name: string): string {
  return `vault/${sportId}/players/${nameToVaultSlug(name)}.json`;
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export interface PublishResult {
  publishedPath: string;
  vaultPath: string;
  statsPath: string;
  rowCount: number;
}

/** Write engine CDN stats + internal vault record. */
export async function publishPlayerSeasonHistory(
  prefix: CdnStatsPrefix,
  slug: string,
  sportId: string,
  vault: PlayerVault,
  rows: PlayerSeasonRow[],
): Promise<PublishResult> {
  const publishedPath = publishedStatsPath(prefix, slug);
  const vaultPath = vaultPlayerPath(sportId, vault.name);
  const statsPath = cdnStatsPath(prefix, slug);

  const vaultRecord: PlayerVault = {
    ...vault,
    slug,
    seasonHistory: rows,
    ingestedAt: new Date().toISOString(),
  };

  await writeJson(publishedPath, rows);
  await writeJson(vaultPath, vaultRecord);

  return { publishedPath, vaultPath, statsPath, rowCount: rows.length };
}

export async function loadPlayerVault(sportId: string, name: string): Promise<PlayerVault | null> {
  try {
    const raw = await readFile(vaultPlayerPath(sportId, name), 'utf8');
    return JSON.parse(raw) as PlayerVault;
  } catch {
    return null;
  }
}

export async function loadPublishedStats(prefix: CdnStatsPrefix, slug: string): Promise<PlayerSeasonRow[] | null> {
  try {
    const raw = await readFile(publishedStatsPath(prefix, slug), 'utf8');
    return JSON.parse(raw) as PlayerSeasonRow[];
  } catch {
    return null;
  }
}

/** Update stats + recent games only when content changed. */
export async function patchPlayerStats(
  prefix: CdnStatsPrefix,
  slug: string,
  sportId: string,
  vault: PlayerVault,
  rows: PlayerSeasonRow[],
  recentGames?: PlayerGameLogRow[],
): Promise<{ updated: boolean; statsPath: string }> {
  const statsPath = cdnStatsPath(prefix, slug);
  const vaultPath = vaultPlayerPath(sportId, vault.name);
  const now = new Date().toISOString();

  const vaultRecord: PlayerVault = {
    ...vault,
    slug,
    seasonHistory: rows,
    recentGames: recentGames?.length ? recentGames : vault.recentGames,
    statsSyncedAt: now,
    ingestedAt: now,
  };

  await writeJson(publishedStatsPath(prefix, slug), rows);
  await writeJson(vaultPath, vaultRecord);

  return { updated: true, statsPath };
}

/** Update profile fields on vault + index metadata (no stats file touch). */
export async function patchPlayerProfile(
  sportId: string,
  vault: PlayerVault,
  profile: {
    name: string;
    team?: string;
    position?: string;
    active?: boolean;
    espnId?: string;
  },
): Promise<boolean> {
  const vaultPath = vaultPlayerPath(sportId, vault.name);
  const now = new Date().toISOString();

  const vaultRecord: PlayerVault = {
    ...vault,
    name: profile.name,
    team: profile.team,
    position: profile.position,
    active: profile.active,
    espnId: profile.espnId ?? vault.espnId,
    profileSyncedAt: now,
    ingestedAt: now,
  };

  await writeJson(vaultPath, vaultRecord);
  return true;
}

export interface PatchPlayerDetailInput {
  details: PlayerDetails;
  headshot?: string;
  headshotSource?: string;
  sources?: string[];
}

/** Update slow-changing bio fields, headshot paths, and vault sources. */
export async function patchPlayerDetail(
  sportId: string,
  vault: PlayerVault,
  patch: PatchPlayerDetailInput,
): Promise<boolean> {
  const vaultPath = vaultPlayerPath(sportId, vault.name);
  const now = new Date().toISOString();

  const vaultRecord: PlayerVault = {
    ...vault,
    headshot: patch.headshot ?? vault.headshot,
    headshotSource: patch.headshotSource ?? vault.headshotSource,
    details: patch.details,
    sources: patch.sources?.length ? patch.sources : vault.sources,
    detailSyncedAt: now,
    ingestedAt: now,
  };

  await writeJson(vaultPath, vaultRecord);
  return true;
}
