import { fetchJson } from '../src/lib/http.js';
import { fetchEspnAthlete } from '../src/sources/espn/fetch.js';
import { getSport } from '../src/sources/espn/config.js';

const bundle = await fetchEspnAthlete(getSport('tennis'), '3782');
const athlete = (bundle?.bio as { athlete?: Record<string, unknown> })?.athlete;
console.log('athlete fields:', athlete ? Object.keys(athlete) : null);
console.log('rank:', athlete?.rank);
console.log('statsSummary:', athlete?.statsSummary);
console.log('overview statistics:', JSON.stringify((bundle?.overview as { statistics?: unknown })?.statistics));
