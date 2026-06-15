import { fetchJson } from '../src/lib/http.js';
import { pickBestNameMatch } from '../src/lib/normalize.js';

const raw = await fetchJson<{ items?: Record<string, unknown>[] }>(
  'https://site.api.espn.com/apis/common/v3/search?query=Magic%20Johnson&limit=20&type=player',
);
console.log(raw.items?.map((i) => ({ id: i.id, name: i.displayName, sport: i.sport, league: i.league })));

// Try last name only for legends
for (const q of ['Johnson basketball', 'Bird basketball', 'Russell basketball']) {
  const r = await fetchJson<{ items?: Record<string, unknown>[] }>(
    `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(q)}&limit=10&type=player`,
  );
  console.log('\n', q, r.items?.map((i) => ({ id: i.id, name: i.displayName, sport: i.sport })));
}
