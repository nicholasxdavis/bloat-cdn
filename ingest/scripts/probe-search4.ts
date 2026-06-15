import { espnGlobalSearchPlayers, fetchEspnAthlete } from '../src/sources/espn/fetch.js';
import { getSport } from '../src/sources/espn/config.js';
import { fetchJson } from '../src/lib/http.js';
import { coerceEspnStatsPayload, parseEspnSeasonHistory } from '../src/sources/espn/parse.js';

async function t(q: string, f?: { sport?: string; league?: string }) {
  const hits = await espnGlobalSearchPlayers(q, f);
  console.log(q, f ?? {}, hits.slice(0, 3).map((h) => ({ id: h.id, name: h.name })));
}

await t('Michael Jordan', { sport: 'basketball', league: 'nba' });
await t('Jon Jones', { sport: 'mma' });
await t('Cristiano Ronaldo', { sport: 'soccer' });
await t('Carlos Alcaraz', { sport: 'tennis' });
await t('Carlos Alcaraz', { sport: 'tennis', league: 'atp' });

// Tennis common athlete endpoints for Alcaraz
const bases = [
  'https://site.api.espn.com/apis/common/v3/sports/tennis/atp/athletes/3782',
  'https://site.api.espn.com/apis/common/v3/sports/tennis/atp/athletes/3782/overview',
  'https://site.api.espn.com/apis/common/v3/sports/tennis/atp/athletes/3782/stats',
  'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/athletes/3782',
];
for (const url of bases) {
  const raw = await fetchJson(url, { headers: { Accept: 'application/json' } }).catch((e) => ({ err: String(e) }));
  const keys = raw && typeof raw === 'object' && !('err' in raw) ? Object.keys(raw) : raw;
  console.log('\n', url.split('/').slice(-2).join('/'), keys);
}

const bundle = await fetchEspnAthlete(getSport('tennis'), '3782');
const bio = bundle?.bio as { athlete?: Record<string, unknown> } | undefined;
console.log('\nbio athlete keys:', bio?.athlete ? Object.keys(bio.athlete) : null);
console.log('record:', (bio?.athlete as { record?: unknown })?.record);
console.log('statsSummary:', JSON.stringify((bio?.athlete as { statsSummary?: unknown })?.statsSummary)?.slice(0, 500));

const payload = coerceEspnStatsPayload(bundle!);
console.log('coerced:', payload);
console.log('rows:', parseEspnSeasonHistory('tennis', payload).length);
