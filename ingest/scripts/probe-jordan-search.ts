import { fetchJson } from '../src/lib/http.js';

const urls = [
  'https://site.api.espn.com/apis/fantasy/v2/games/fba/players?search=Michael%20Jordan&limit=5',
  'https://site.api.espn.com/apis/common/v3/search?query=Michael%20Jordan&limit=10',
  'https://site.api.espn.com/apis/common/v3/search?query=Michael%20Jordan&limit=10&type=player',
  'https://site.api.espn.com/apis/common/v3/search?query=Michael%20Jordan&limit=10&type=athlete',
];

for (const url of urls) {
  const raw = await fetchJson<Record<string, unknown>>(url, { headers: { Accept: 'application/json' } }).catch((e) => ({ err: String(e) }));
  const items = (raw as { items?: unknown[] }).items ?? (raw as { players?: unknown[] }).players ?? raw;
  console.log('\n', url.split('?')[1] ?? url, JSON.stringify(items).slice(0, 400));
}
