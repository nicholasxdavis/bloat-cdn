import { espnGlobalSearchPlayers, searchEspnAthletes, fetchEspnAthlete } from '../src/sources/espn/fetch.js';
import { getSport } from '../src/sources/espn/config.js';
import { coerceEspnStatsPayload, parseEspnSeasonHistory } from '../src/sources/espn/parse.js';

const names = [
  'Jon Jones',
  'Canelo Alvarez',
  'Carlos Alcaraz',
  'Cristiano Ronaldo',
  'Michael Jordan',
  'Roger Federer',
];

for (const n of names) {
  const global = await espnGlobalSearchPlayers(n);
  const mma = await searchEspnAthletes(getSport('fights'), n, 3);
  const ten = await searchEspnAthletes(getSport('tennis'), n, 3);
  const mls = await searchEspnAthletes(getSport('mls'), n, 3);
  console.log('\n===', n, '===');
  console.log('global', global.slice(0, 3).map((h) => ({ id: h.id, name: h.name })));
  console.log('fights', mma.map((h) => ({ id: h.id, name: h.name })));
  console.log('tennis', ten.map((h) => ({ id: h.id, name: h.name })));
  console.log('mls', mls.map((h) => ({ id: h.id, name: h.name })));
}

// Probe tennis stats shape for Alcaraz
const alcaraz = await searchEspnAthletes(getSport('tennis'), 'Carlos Alcaraz', 1);
if (alcaraz[0]) {
  const bundle = await fetchEspnAthlete(getSport('tennis'), alcaraz[0].id);
  const payload = coerceEspnStatsPayload(bundle!);
  console.log('\n=== Alcaraz stats payload ===');
  console.log(JSON.stringify(payload, null, 2).slice(0, 3000));
  console.log('rows', parseEspnSeasonHistory('tennis', payload).length);
}
