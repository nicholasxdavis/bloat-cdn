import { readFile } from 'node:fs/promises';
import { repoPath } from './publish.js';

export interface NeedPlayer {
  sportId: string;
  name: string;
  legend: boolean;
}

/** Map keys in need.json → bloat sport ids. */
const NEED_SPORT_KEYS: Record<string, string> = {
  ufc_mma: 'fights',
  boxing: 'fights',
  mma: 'fights',
  soccer: 'mls',
};

export function mapNeedSportKey(key: string): string {
  return NEED_SPORT_KEYS[key] ?? key;
}

type NeedJson = Record<string, string[] | Record<string, string[]>>;

function isLegendBlock(value: unknown): value is Record<string, string[]> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function flattenNeedJson(data: NeedJson): NeedPlayer[] {
  const out: NeedPlayer[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === 'legends' && isLegendBlock(value)) {
      for (const [legendSport, names] of Object.entries(value)) {
        const sportId = mapNeedSportKey(legendSport);
        for (const name of names) {
          out.push({ sportId, name, legend: true });
        }
      }
      continue;
    }
    if (!Array.isArray(value)) continue;
    const sportId = mapNeedSportKey(key);
    for (const name of value) {
      out.push({ sportId, name, legend: false });
    }
  }

  return out;
}

export async function loadNeedList(filePath?: string): Promise<NeedPlayer[]> {
  const path = filePath ?? repoPath('need.json');
  const raw = await readFile(path, 'utf8');
  return flattenNeedJson(JSON.parse(raw) as NeedJson);
}

export function filterNeedList(
  players: NeedPlayer[],
  opts: { sport?: string; legendsOnly?: boolean; currentOnly?: boolean },
): NeedPlayer[] {
  return players.filter((p) => {
    if (opts.sport && p.sportId !== opts.sport) return false;
    if (opts.legendsOnly && !p.legend) return false;
    if (opts.currentOnly && p.legend) return false;
    return true;
  });
}
