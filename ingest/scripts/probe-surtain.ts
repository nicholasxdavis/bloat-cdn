import { searchEspnAthletes } from '../src/sources/espn/fetch.js';
import { getSport } from '../src/sources/espn/config.js';
import { espnGlobalSearchPlayers } from '../src/sources/espn/fetch.js';

for (const q of ['Patrick Surtain II', 'Patrick Surtain', 'Surtain']) {
  const nfl = await searchEspnAthletes(getSport('nfl'), q, 5);
  const global = await espnGlobalSearchPlayers(q, { sport: 'football', league: 'nfl' });
  console.log(q, { nfl, global: global.slice(0, 3) });
}
