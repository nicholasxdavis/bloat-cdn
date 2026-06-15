import { fetchJson } from '../src/lib/http.js';

const G = 'https://site.api.espn.com/apis/common/v3/search';
const SITE = 'https://site.api.espn.com/apis/site/v2/sports';

async function gSearch(q: string, extra = '') {
  const raw = await fetchJson<{ items?: Record<string, unknown>[] }>(
    `${G}?query=${encodeURIComponent(q)}&limit=10&type=player${extra}`,
    { headers: { Accept: 'application/json' } },
  ).catch(() => null);
  return raw?.items?.map((i) => ({ id: i.id, name: i.displayName, sport: i.sport, league: i.league })) ?? [];
}

for (const q of ['Canelo Alvarez', 'Terence Crawford', 'Muhammad Ali', 'Roger Federer', 'Michael Jordan', 'Pele', 'Cristiano Ronaldo']) {
  console.log('\n', q, await gSearch(q));
}

// Alcaraz bio + site endpoints
const bio = await fetchJson(`${SITE}/tennis/atp/athletes/3782`, { headers: { Accept: 'application/json' } });
console.log('\nAlcaraz site athlete keys:', Object.keys(bio as object));
console.log('athlete stats:', JSON.stringify((bio as { athlete?: { statsSummary?: unknown; statistics?: unknown } }).athlete, null, 2)?.slice(0, 2500));

const stats = await fetchJson(`${SITE}/tennis/atp/athletes/3782/stats`, { headers: { Accept: 'application/json' } }).catch((e) => e.message);
console.log('\nAlcaraz /stats:', typeof stats === 'string' ? stats : JSON.stringify(stats, null, 2)?.slice(0, 2000));

// Federer - try core search with tennis filter only
console.log('\nFederer filtered mma sport:', await gSearch('Roger Federer')); 
const fedItems = await fetchJson<{ items?: Record<string, unknown>[] }>(`${G}?query=Federer&limit=10&type=player`);
console.log('Federer short:', fedItems.items?.map((i) => ({ id: i.id, name: i.displayName, sport: i.sport, league: i.league })));

// Jon Jones with sport filter only
const jj = await fetchJson<{ items?: Record<string, unknown>[] }>(`${G}?query=Jon%20Jones&limit=10&type=player`);
const mmaOnly = jj.items?.filter((i) => String(i.sport).toLowerCase() === 'mma');
console.log('\nJon Jones mma filtered:', mmaOnly?.map((i) => ({ id: i.id, name: i.displayName })));
