import { fetchJson } from '../src/lib/http.js';
import { espnGlobalSearchPlayers, fetchEspnAthlete } from '../src/sources/espn/fetch.js';
import { getSport } from '../src/sources/espn/config.js';

const ESPN_GLOBAL = 'https://site.api.espn.com/apis/common/v3/search';
const MMA_COMMON = 'https://site.api.espn.com/apis/common/v3/sports/mma/athletes';
const ATP_COMMON = 'https://site.api.espn.com/apis/common/v3/sports/tennis/atp';

async function rawSearch(url: string) {
  const raw = await fetchJson<{ items?: unknown[] }>(url, { headers: { Accept: 'application/json' } }).catch((e) => ({ error: String(e) }));
  return raw;
}

// Jon Jones global item metadata
const jj = await fetchJson<{ items?: Record<string, unknown>[] }>(
  `${ESPN_GLOBAL}?query=${encodeURIComponent('Jon Jones')}&limit=5&type=player`,
);
console.log('Jon Jones global items:', jj.items?.map((i) => ({ id: i.id, name: i.displayName, sport: i.sport, league: i.league })));

// MMA direct search
console.log('\nMMA direct Jon Jones:', await rawSearch(`${MMA_COMMON}?search=${encodeURIComponent('Jon Jones')}&limit=5`));
console.log('\nMMA direct Canelo:', await rawSearch(`${MMA_COMMON}?search=${encodeURIComponent('Canelo Alvarez')}&limit=5`));

// Tennis ATP
console.log('\nATP Federer:', await rawSearch(`${ATP_COMMON}/athletes?search=${encodeURIComponent('Roger Federer')}&limit=5`));
console.log('\nATP Alcaraz:', await rawSearch(`${ATP_COMMON}/athletes?search=${encodeURIComponent('Carlos Alcaraz')}&limit=5`));

// Alcaraz bundle
const bundle = await fetchEspnAthlete(getSport('tennis'), '3782');
console.log('\nAlcaraz bundle keys:', bundle ? Object.keys(bundle) : null);
console.log('bio keys:', bundle?.bio ? Object.keys(bundle.bio as object) : null);
console.log('stats sample:', JSON.stringify(bundle?.stats, null, 2)?.slice(0, 2000));
console.log('overview sample:', JSON.stringify(bundle?.overview, null, 2)?.slice(0, 2000));

// Global unfiltered for boxing
const caneloG = await espnGlobalSearchPlayers('Canelo Alvarez');
console.log('\nCanelo global unfiltered:', caneloG);

// Soccer Ronaldo with eng.1
const SOC = 'https://site.api.espn.com/apis/common/v3/sports/soccer/eng.1';
console.log('\nRonaldo eng.1:', await rawSearch(`${SOC}/athletes?search=${encodeURIComponent('Cristiano Ronaldo')}&limit=3`));
