import { espnGlobalSearchPlayers } from '../src/sources/espn/fetch.js';

const tests: Array<[string, { sport?: string; league?: string } | undefined]> = [
  ['Michael Jordan', { sport: 'basketball' }],
  ['Kobe Bryant', { sport: 'basketball' }],
  ['Tom Brady', { sport: 'football' }],
  ['Wayne Gretzky', { sport: 'hockey' }],
  ['Babe Ruth', { sport: 'baseball' }],
];

for (const [name, filter] of tests) {
  const hits = await espnGlobalSearchPlayers(name, filter);
  console.log(name, hits.slice(0, 3).map((h) => ({ id: h.id, name: h.name })));
}
