import { fetchJson } from '../src/lib/http.js';
import { LEGEND_ESPN_IDS } from '../src/lib/legendIds.js';
import { normalizeName } from '../src/lib/normalize.js';

const SPORT_PATH: Record<string, string> = {
  nba: 'basketball/nba',
  nfl: 'football/nfl',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
  fights: 'mma',
  golf: 'golf/pga',
  tennis: 'tennis/atp',
  mls: 'soccer/usa.1',
};

for (const [sport, entries] of Object.entries(LEGEND_ESPN_IDS)) {
  const path = SPORT_PATH[sport];
  if (!path) continue;
  for (const [key, id] of Object.entries(entries)) {
    const raw = await fetchJson<{ athlete?: { displayName?: string } }>(
      `https://site.api.espn.com/apis/common/v3/sports/${path}/athletes/${id}`,
      { headers: { Accept: 'application/json' } },
    ).catch(() => null);
    const name = raw?.athlete?.displayName ?? 'NOT FOUND';
    const ok = normalizeName(name).includes(key.split(' ').pop() ?? '___');
    console.log(ok ? 'OK' : 'BAD', sport, key, id, '->', name);
    await new Promise((r) => setTimeout(r, 200));
  }
}
