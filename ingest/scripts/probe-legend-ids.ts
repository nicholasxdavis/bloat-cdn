import { fetchJson } from '../src/lib/http.js';

const legends = [
  ['Michael Jordan', 1035],
  ['Kobe Bryant', 110],
  ['Magic Johnson', 771],
  ['Larry Bird', 33],
  ['Shaquille O\'Neal', 614],
  ['Tom Brady', 2330],
  ['Wayne Gretzky', 99],
];

for (const [name, id] of legends) {
  const raw = await fetchJson<{ athlete?: { displayName?: string } }>(
    `https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}`,
    { headers: { Accept: 'application/json' } },
  ).catch(async () => {
    const nfl = await fetchJson<{ athlete?: { displayName?: string } }>(
      `https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${id}`,
      { headers: { Accept: 'application/json' } },
    ).catch(() => null);
    return nfl;
  });
  console.log(name, id, raw?.athlete?.displayName ?? 'NOT FOUND');
}
