import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { normalizeName, pickBestTeamNameMatch } from './normalize.js';
import type { TeamIndex, TeamIndexEntry } from '../types/team.js';
import { repoPath } from './publish.js';

const INDEX_PATH = () => repoPath('published', 'meta', 'team-index.json');

export async function loadTeamIndex(): Promise<TeamIndex> {
  try {
    const raw = await readFile(INDEX_PATH(), 'utf8');
    return JSON.parse(raw) as TeamIndex;
  } catch {
    return { version: 1, syncedAt: '', teams: [] };
  }
}

function entryKey(sport: string, name: string): string {
  return `${sport}:${normalizeName(name)}`;
}

export async function upsertTeamIndex(entry: TeamIndexEntry): Promise<TeamIndex> {
  const index = await loadTeamIndex();
  const key = entryKey(entry.sport, entry.name);
  const teams = index.teams.filter((t) => entryKey(t.sport, t.name) !== key);
  teams.push(entry);
  teams.sort((a, b) => a.sport.localeCompare(b.sport) || a.name.localeCompare(b.name));

  const next: TeamIndex = { version: 1, syncedAt: new Date().toISOString(), teams };
  await mkdir(path.dirname(INDEX_PATH()), { recursive: true });
  await writeFile(INDEX_PATH(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function isTeamIndexed(index: TeamIndex, sport: string, name: string): boolean {
  const sportTeams = index.teams.filter((t) => t.sport === sport);
  return pickBestTeamNameMatch(name, sportTeams) !== null;
}

export function cdnTeamsRegistryPath(sportId: string): string {
  return `teams/${sportId}.json`;
}
