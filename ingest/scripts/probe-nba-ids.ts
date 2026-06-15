import { fetchJson } from '../src/lib/http.js';

const BASE = 'https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes';

const candidates: Array<[string, number]> = [
  ['Michael Jordan', 1035],
  ['Kobe Bryant', 110],
  ['Magic Johnson', 771],
  ['Larry Bird', 33],
  ['Shaquille O\'Neal', 614],
  ['Tim Duncan', 1495],
  ['Kareem Abdul-Jabbar', 99],
  ['Wilt Chamberlain', 760],
  ['Bill Russell', 818],
  ['Hakeem Olajuwon', 345],
  ['Dirk Nowitzki', 609],
  ['Charles Barkley', 341],
  ['Allen Iverson', 420],
  ['Kevin Garnett', 261],
  ['Jerry West', 904],
  ['Dwyane Wade', 1977],
  ['Scottie Pippen', 670],
  ['David Robinson', 687],
  ['Moses Malone', 576],
  ['John Stockton', 812],
  ['Julius Erving', 288],
  ['Oscar Robertson', 682],
];

for (const [name, id] of candidates) {
  const raw = await fetchJson<{ athlete?: { displayName?: string } }>(`${BASE}/${id}`, {
    headers: { Accept: 'application/json' },
  }).catch(() => null);
  const got = raw?.athlete?.displayName ?? 'NOT FOUND';
  const ok = got.toLowerCase().includes(name.split(' ').pop()!.toLowerCase()) ? '✓' : '✗';
  console.log(ok, id, name, '->', got);
}
