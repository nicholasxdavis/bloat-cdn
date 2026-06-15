import { fetchText } from '../../lib/http.js';
import type { PlayerSeasonRow } from '../../types/siyf.js';

export function aggregateSherdogFights(html: string): PlayerSeasonRow[] {
  const byYear = new Map<string, { gp: number; wins: number; losses: number; draws: number }>();
  const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowPattern) ?? [];

  for (const row of rows) {
    const dateMatch = row.match(/(\w{3}\s+\d{1,2},\s+(\d{4}))/);
    if (!dateMatch) continue;
    const year = dateMatch[2];
    const resultMatch = row.match(/>\s*(win|loss|draw|nc)\s*</i);
    if (!resultMatch) continue;

    const bucket = byYear.get(year) ?? { gp: 0, wins: 0, losses: 0, draws: 0 };
    bucket.gp += 1;
    const result = resultMatch[1].toLowerCase();
    if (result === 'win') bucket.wins += 1;
    else if (result === 'loss') bucket.losses += 1;
    else bucket.draws += 1;
    byYear.set(year, bucket);
  }

  return Array.from(byYear.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 15)
    .map(([season, stats]) => ({
      season,
      gp: String(stats.gp),
      min: '-',
      pts: String(stats.wins),
      reb: String(stats.losses),
      ast: String(stats.draws),
      stl: '-',
      blk: '-',
      fgPct: '-',
      fg3Pct: '-',
      ftPct: '-',
      to: '-',
    }));
}

export async function fetchSherdogSeasonHistory(playerName: string): Promise<PlayerSeasonRow[]> {
  const searchHtml = await fetchText(
    `https://www.sherdog.com/stats/fightfinder?SearchText=${encodeURIComponent(playerName)}`,
    { headers: { Accept: 'text/html,*/*' } },
  ).catch(() => null);
  if (!searchHtml) return [];

  const fighterMatch = searchHtml.match(/href="(\/fighter\/[^"]+)"/i);
  if (!fighterMatch?.[1]) return [];

  const fighterHtml = await fetchText(`https://www.sherdog.com${fighterMatch[1]}`, {
    headers: { Accept: 'text/html,*/*' },
  }).catch(() => null);

  return fighterHtml ? aggregateSherdogFights(fighterHtml) : [];
}
