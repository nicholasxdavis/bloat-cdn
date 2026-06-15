import { fetchJson } from '../src/lib/http.js';
import { readFile } from 'node:fs/promises';
import { repoPath } from '../src/lib/publish.js';
import { flattenNeedJson } from '../src/lib/needList.js';
import { pickBestNameMatch } from '../src/lib/normalize.js';

const CORE = 'https://sports.core.api.espn.com/v3/search';

async function coreSearch(name: string) {
  const raw = await fetchJson<{ items?: Record<string, unknown>[] }>(
    `${CORE}?query=${encodeURIComponent(name)}&limit=15&type=player`,
    { headers: { Accept: 'application/json' } },
  ).catch(() => null);
  return (raw?.items ?? []).map((i) => ({
    id: String(i.id),
    name: String(i.displayName ?? i.fullName),
    sport: String(i.sport ?? ''),
    league: String(i.league ?? ''),
  }));
}

const need = flattenNeedJson(JSON.parse(await readFile(repoPath('need.json'), 'utf8')));
const legends = need.filter((p) => p.legend);

const found: Record<string, string> = {};
for (const p of legends) {
  const hits = await coreSearch(p.name);
  const match = pickBestNameMatch(p.name, hits);
  if (match && Number(match.id) > 0) {
    const key = `${p.sportId}:${p.name}`;
    found[key] = match.id;
    console.log('OK', key, match.id, hits.find((h) => h.name === match.name)?.sport);
  } else {
    console.log('MISS', p.sportId, p.name, hits.slice(0, 2));
  }
  await new Promise((r) => setTimeout(r, 300));
}

console.log('\nTotal found:', Object.keys(found).length, '/', legends.length);
