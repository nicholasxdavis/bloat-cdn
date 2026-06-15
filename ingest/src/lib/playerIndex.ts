import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { normalizeName } from './normalize.js';
import { repoPath } from './publish.js';

export interface PlayerIndexEntry {
  sport: string;
  name: string;
  slug: string;
  espnId?: string;
  legend: boolean;
  headshot?: string;
  /** CDN-relative stats path the engine reads (team sports). */
  statsPath?: string;
  vaultPath: string;
  rowCount: number;
  sources: string[];
  ingestedAt: string;
  /** Last profile sync (weekly). */
  profileSyncedAt?: string;
  /** Last stats sync (nightly). */
  statsSyncedAt?: string;
  /** Last detail sync (bi-monthly). */
  detailSyncedAt?: string;
  team?: string;
  position?: string;
  active?: boolean;
}

export interface PlayerIndex {
  version: number;
  syncedAt: string;
  players: PlayerIndexEntry[];
}

const INDEX_PATH = () => repoPath('published', 'meta', 'player-index.json');

export async function loadPlayerIndex(): Promise<PlayerIndex> {
  try {
    const raw = await readFile(INDEX_PATH(), 'utf8');
    return JSON.parse(raw) as PlayerIndex;
  } catch {
    return { version: 1, syncedAt: '', players: [] };
  }
}

function entryKey(sport: string, name: string, legend: boolean): string {
  return `${sport}:${legend ? 'legend' : 'current'}:${normalizeName(name)}`;
}

export async function upsertPlayerIndex(entry: PlayerIndexEntry): Promise<PlayerIndex> {
  const index = await loadPlayerIndex();
  const key = entryKey(entry.sport, entry.name, entry.legend);
  const players = index.players.filter(
    (p) => entryKey(p.sport, p.name, p.legend) !== key,
  );
  players.push(entry);
  players.sort((a, b) => a.sport.localeCompare(b.sport) || a.name.localeCompare(b.name));

  const next: PlayerIndex = {
    version: 1,
    syncedAt: new Date().toISOString(),
    players,
  };

  await mkdir(path.dirname(INDEX_PATH()), { recursive: true });
  await writeFile(INDEX_PATH(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function isPlayerIndexed(
  index: PlayerIndex,
  sport: string,
  name: string,
  legend: boolean,
): boolean {
  const key = entryKey(sport, name, legend);
  return index.players.some((p) => entryKey(p.sport, p.name, p.legend) === key);
}
