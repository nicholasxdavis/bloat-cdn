import { fetchJson } from '../src/lib/http.js';
import { flattenNeedJson } from '../src/lib/needList.js';
import { loadNeedList } from '../src/lib/needList.js';
import { pickBestNameMatch } from '../src/lib/normalize.js';

const LEAGUE_BASE: Record<string, string> = {
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl',
};

const legends = (await loadNeedList()).filter((p) => p.legend && LEAGUE_BASE[p.sportId]);

for (const p of legends.slice(0, 8)) {
  const base = LEAGUE_BASE[p.sportId];
  const raw = await fetchJson<{ athletes?: Array<{ id?: string; displayName?: string }> }>(
    `${base}/athletes?search=${encodeURIComponent(p.name)}&limit=10`,
    { headers: { Accept: 'application/json' } },
  ).catch(() => null);
  const hits = (raw?.athletes ?? []).map((a) => ({ id: String(a.id), name: String(a.displayName) }));
  const match = pickBestNameMatch(p.name, hits);
  console.log(p.sportId, p.name, match ?? 'MISS', hits.slice(0, 2));
}
