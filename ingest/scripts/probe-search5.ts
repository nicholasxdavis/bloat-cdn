import { fetchJson } from '../src/lib/http.js';

const overview = await fetchJson<Record<string, unknown>>(
  'https://site.api.espn.com/apis/common/v3/sports/tennis/atp/athletes/3782/overview',
  { headers: { Accept: 'application/json' } },
);
console.log('overview statistics:', JSON.stringify(overview.statistics, null, 2)?.slice(0, 4000));

// Michael Jordan - try basketball without league
const g = await fetchJson<{ items?: Record<string, unknown>[] }>(
  'https://site.api.espn.com/apis/common/v3/search?query=Michael%20Jordan&limit=20&type=player',
);
const bball = g.items?.filter((i) => String(i.sport) === 'basketball');
console.log('\nJordan basketball:', bball?.map((i) => ({ id: i.id, name: i.displayName, league: i.league })));

// Known Jordan id probe
for (const id of ['1035', '1067', '1966', '6589']) {
  const raw = await fetchJson(
    `https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}`,
    { headers: { Accept: 'application/json' } },
  ).catch((e) => ({ err: e.status }));
  const name = (raw as { athlete?: { displayName?: string } })?.athlete?.displayName;
  console.log('nba id', id, name ?? raw);
}

// MMA Jon Jones overview stats
const jj = await fetchJson(
  'https://site.api.espn.com/apis/common/v3/sports/mma/athletes/2335639/overview',
  { headers: { Accept: 'application/json' } },
).catch(() => null);
console.log('\nJon Jones overview stats:', JSON.stringify((jj as { statistics?: unknown })?.statistics, null, 2)?.slice(0, 2000));

const jjBio = await fetchJson(
  'https://site.api.espn.com/apis/common/v3/sports/mma/athletes/2335639',
  { headers: { Accept: 'application/json' } },
);
console.log('Jon Jones record:', (jjBio as { athlete?: { record?: unknown } }).athlete?.record);
