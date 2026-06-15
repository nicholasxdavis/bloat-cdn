import { ingestPlayer } from '../src/pipeline/ingestPlayer.js';

const samples = [
  { sportId: 'fights', name: 'Jon Jones' },
  { sportId: 'fights', name: 'Islam Makhachev' },
  { sportId: 'mls', name: 'Cristiano Ronaldo', legend: true },
  { sportId: 'nba', name: 'Michael Jordan', legend: true },
  { sportId: 'tennis', name: 'Carlos Alcaraz' },
  { sportId: 'tennis', name: 'Roger Federer', legend: true },
  { sportId: 'nfl', name: 'Patrick Surtain II' },
];

for (const sample of samples) {
  const result = await ingestPlayer({ ...sample, skipIndex: true, skipHeadshot: true });
  console.log(
    sample.sportId,
    sample.name,
    result.ok ? `OK ${result.rowCount} rows [${result.sources.join(',')}]` : `FAIL ${result.error}`,
  );
}
