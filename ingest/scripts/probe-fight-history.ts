import { fetchJson } from '../src/lib/http.js';

const adesanya = await fetchJson<Record<string, unknown>>(
  'https://site.api.espn.com/apis/common/v3/sports/mma/athletes/4285679/overview',
);
console.log('Adesanya fightHistory:', JSON.stringify(adesanya.fightHistory, null, 2)?.slice(0, 5000));

const jj = await fetchJson<Record<string, unknown>>(
  'https://site.api.espn.com/apis/common/v3/sports/mma/athletes/2335639/overview',
);
console.log('\nJJ fightHistory count:', Array.isArray(jj.fightHistory) ? jj.fightHistory.length : jj.fightHistory);
console.log('JJ fightHistory sample:', JSON.stringify(jj.fightHistory, null, 2)?.slice(0, 3000));
