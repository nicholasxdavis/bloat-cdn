import { fetchJson } from '../src/lib/http.js';

// MMA core records
const jjRecords = await fetchJson(
  'https://site.api.espn.com/apis/common/v3/sports/mma/athletes/2335639/overview',
  { headers: { Accept: 'application/json' } },
).catch(() => null);
console.log('JJ overview keys:', jjRecords ? Object.keys(jjRecords as object) : null);
console.log('JJ overview full:', JSON.stringify(jjRecords, null, 2)?.slice(0, 3000));

const jjCore = await fetchJson(
  'https://sports.core.api.espn.com/v2/sports/mma/athletes/2335639/records',
  { headers: { Accept: 'application/json' } },
).catch((e) => e.message);
console.log('\nJJ core records:', JSON.stringify(jjCore, null, 2)?.slice(0, 1500));

// Tennis gameLog
const alcarazOv = await fetchJson<Record<string, unknown>>(
  'https://site.api.espn.com/apis/common/v3/sports/tennis/atp/athletes/3782/overview',
);
console.log('\nAlcaraz gameLog:', JSON.stringify(alcarazOv.gameLog, null, 2)?.slice(0, 2000));

// Israel Adesanya - already ingested, check what worked
const adesanya = await fetchJson(
  'https://site.api.espn.com/apis/common/v3/sports/mma/athletes/4285679/overview',
  { headers: { Accept: 'application/json' } },
).catch(() => null);
console.log('\nAdesanya overview statistics:', JSON.stringify((adesanya as { statistics?: unknown })?.statistics, null, 2)?.slice(0, 2000));
