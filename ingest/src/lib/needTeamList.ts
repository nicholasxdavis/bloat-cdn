import { readFile } from 'node:fs/promises';
import { repoPath } from './publish.js';

export interface NeedTeamItem {
  sportId: string;
  name: string;
  tier?: string;
  top10: boolean;
}

type NeedTeamJson = Record<string, unknown>;

const SUPPORTED_SPORTS = new Set(['nba', 'nfl', 'mlb', 'nhl', 'mls', 'epl']);
const SKIP_SPORTS = new Set(['boxing', 'golf']);

function tierKeyLabel(key: string): string | undefined {
  if (!key.startsWith('tier')) return undefined;
  return key.replace(/_/g, ' ');
}

export function parseNeedTeamJson(data: NeedTeamJson): {
  bySport: Map<string, Set<string>>;
  tierByName: Map<string, string>;
  top10: Set<string>;
} {
  const bySport = new Map<string, Set<string>>();
  const tierByName = new Map<string, string>();
  const top10 = new Set<string>();

  for (const [key, value] of Object.entries(data)) {
    if (key === 'by_sport' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [sport, names] of Object.entries(value as Record<string, string[]>)) {
        if (SKIP_SPORTS.has(sport)) continue;
        if (!SUPPORTED_SPORTS.has(sport)) continue;
        const set = bySport.get(sport) ?? new Set<string>();
        for (const name of names) set.add(name);
        bySport.set(sport, set);
      }
      continue;
    }

    if (key === 'top10_overall' && Array.isArray(value)) {
      for (const name of value) top10.add(String(name));
      continue;
    }

    const tier = tierKeyLabel(key);
    if (tier && Array.isArray(value)) {
      for (const name of value) tierByName.set(String(name), tier);
    }
  }

  return { bySport, tierByName, top10 };
}

export async function loadNeedTeamList(filePath?: string): Promise<NeedTeamItem[]> {
  const path = filePath ?? repoPath('need-team.json');
  const raw = await readFile(path, 'utf8');
  const data = JSON.parse(raw) as NeedTeamJson;
  const { bySport, tierByName, top10 } = parseNeedTeamJson(data);

  const items: NeedTeamItem[] = [];
  for (const [sportId, names] of bySport) {
    for (const name of names) {
      items.push({
        sportId,
        name,
        tier: tierByName.get(name),
        top10: top10.has(name),
      });
    }
  }

  return items;
}

export function filterNeedTeamList(
  items: NeedTeamItem[],
  opts: { sport?: string },
): NeedTeamItem[] {
  if (!opts.sport) return items;
  return items.filter((i) => i.sportId === opts.sport);
}
