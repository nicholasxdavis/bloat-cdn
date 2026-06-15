import { fetchJson } from '../src/lib/http.js';
import { pickBestNameMatch, normalizeName } from '../src/lib/normalize.js';

const G = 'https://site.api.espn.com/apis/common/v3/search';
const SPORT_EXPECTED: Record<string, string[]> = {
  nba: ['basketball'],
  nfl: ['football'],
  mlb: ['baseball'],
  nhl: ['hockey'],
  fights: ['mma', 'boxing'],
  golf: ['golf'],
  tennis: ['tennis'],
  mls: ['soccer'],
};

async function search(name: string) {
  const raw = await fetchJson<{ items?: Record<string, unknown>[] }>(
    `${G}?query=${encodeURIComponent(name)}&limit=15&type=player`,
  );
  return raw.items ?? [];
}

const samples = [
  ['nba', 'Michael Jordan'],
  ['nba', 'Magic Johnson'],
  ['nba', 'Larry Bird'],
  ['nba', 'Kareem Abdul-Jabbar'],
  ['nfl', 'Tom Brady'],
  ['nfl', 'Jerry Rice'],
  ['mlb', 'Babe Ruth'],
  ['nhl', 'Wayne Gretzky'],
  ['fights', 'Jon Jones'],
  ['fights', 'Conor McGregor'],
  ['mls', 'Cristiano Ronaldo'],
  ['tennis', 'Carlos Alcaraz'],
  ['tennis', 'Roger Federer'],
];

for (const [sport, name] of samples) {
  const items = await search(name);
  const expected = SPORT_EXPECTED[sport] ?? [];
  const filtered = items.filter((i) => expected.includes(String(i.sport ?? '').toLowerCase()));
  const hits = filtered.map((i) => ({
    id: String(i.id),
    name: String(i.displayName),
    sport: String(i.sport),
    league: String(i.league ?? ''),
  }));
  const match = pickBestNameMatch(name, hits);
  console.log(sport, name, '->', match ? { id: match.id, name: match.name, sport: hits.find((h) => h.name === match.name)?.sport } : 'NO MATCH', hits.slice(0, 3));
}
