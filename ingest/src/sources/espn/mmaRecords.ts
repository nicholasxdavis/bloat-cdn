import { fetchJson } from '../../lib/http.js';
import type { PlayerSeasonRow } from '../../types/siyf.js';

const CORE_MMA = 'https://sports.core.api.espn.com/v2/sports/mma/athletes';

interface CoreRecordItem {
  summary?: string;
  displayValue?: string;
  stats?: Array<{ name?: string; displayValue?: string }>;
}

export async function fetchMmaCoreCareerRow(athleteId: string): Promise<PlayerSeasonRow | null> {
  const raw = await fetchJson<{ items?: CoreRecordItem[] }>(
    `${CORE_MMA}/${athleteId}/records`,
    { headers: { Accept: 'application/json' } },
  ).catch(() => null);

  const overall = raw?.items?.find((item) => /overall|total/i.test(String(item.summary ?? '')))
    ?? raw?.items?.[0];
  if (!overall) return null;

  const summary = overall.summary ?? overall.displayValue ?? '';
  const parts = summary.split('-').map((p) => p.trim());
  const wins = parts[0] ?? '-';
  const losses = parts[1] ?? '-';
  const draws = parts[2] ?? '0';

  return {
    season: 'Career',
    gp: summary || '-',
    min: '-',
    pts: wins,
    reb: losses,
    ast: draws,
    stl: '-',
    blk: '-',
    fgPct: '-',
    fg3Pct: '-',
    ftPct: '-',
    to: '-',
  };
}
