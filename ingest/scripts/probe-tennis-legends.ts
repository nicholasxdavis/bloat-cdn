import { fetchEspnAthlete } from '../src/sources/espn/fetch.js';
import { getSport } from '../src/sources/espn/config.js';
import { coerceEspnStatsPayload, parseEspnSeasonHistory } from '../src/sources/espn/parse.js';

for (const id of ['425', '394', '3782']) {
  const bundle = await fetchEspnAthlete(getSport('tennis'), id);
  const athlete = (bundle?.bio as { athlete?: Record<string, unknown> })?.athlete;
  const payload = coerceEspnStatsPayload(bundle!);
  const rows = parseEspnSeasonHistory('tennis', payload);
  console.log(id, athlete?.displayName, {
    debutYear: athlete?.debutYear,
    active: athlete?.active,
    rows: rows.length,
    overviewKeys: bundle?.overview ? Object.keys(bundle.overview as object) : [],
    statsKeys: bundle?.stats ? Object.keys(bundle.stats as object) : [],
  });
}
