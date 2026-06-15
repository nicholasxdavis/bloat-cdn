import type { PlayerGameLogRow, PlayerSeasonRow } from '../../types/siyf.js';

type LabelIndex = Record<keyof Omit<PlayerSeasonRow, 'season' | 'team'>, number>;

type LabelIndexFn = (labels: string[]) => LabelIndex;

function rowFromIndices(stats: (string | number)[], idx: LabelIndex): Omit<PlayerSeasonRow, 'season' | 'team'> {
  const val = (key: keyof LabelIndex) => {
    const i = idx[key];
    if (i === undefined || i < 0) return '-';
    const v = stats[i];
    return v === undefined || v === null || v === '' ? '-' : String(v);
  };
  return {
    gp: val('gp'),
    min: val('min'),
    pts: val('pts'),
    reb: val('reb'),
    ast: val('ast'),
    stl: val('stl'),
    blk: val('blk'),
    fgPct: val('fgPct'),
    fg3Pct: val('fg3Pct'),
    ftPct: val('ftPct'),
    to: val('to'),
  };
}

const BASKETBALL_LABELS: LabelIndexFn = (labels) => ({
  gp: labelIndex(labels, 'GP'),
  min: labelIndex(labels, 'MIN'),
  pts: labelIndex(labels, 'PTS'),
  reb: labelIndex(labels, 'REB'),
  ast: labelIndex(labels, 'AST'),
  stl: labelIndex(labels, 'STL'),
  blk: labelIndex(labels, 'BLK'),
  fgPct: labelIndex(labels, 'FG%', 'FG PCT'),
  fg3Pct: labelIndex(labels, '3P%', '3PT%', '3P PCT'),
  ftPct: labelIndex(labels, 'FT%', 'FT PCT'),
  to: labelIndex(labels, 'TO', 'TOV'),
});

const FOOTBALL_LABELS: LabelIndexFn = (labels) => {
  const i = (label: string) => labels.indexOf(label);
  return {
    gp: i('GP'),
    min: i('MIN'),
    pts: i('YDS') >= 0 ? i('YDS') : i('PASS YDS'),
    reb: i('TD'),
    ast: i('INT'),
    stl: i('CMP'),
    blk: i('ATT'),
    fgPct: i('QBR'),
    fg3Pct: i('RTG'),
    ftPct: i('SACKS'),
    to: i('FUM'),
  };
};

const BASEBALL_LABELS: LabelIndexFn = (labels) => {
  const i = (label: string) => labels.indexOf(label);
  return {
    gp: i('GP'),
    min: i('AB'),
    pts: i('AVG'),
    reb: i('HR'),
    ast: i('RBI'),
    stl: i('SB'),
    blk: i('SO'),
    fgPct: i('ERA'),
    fg3Pct: i('WHIP'),
    ftPct: i('W'),
    to: i('L'),
  };
};

const HOCKEY_LABELS: LabelIndexFn = (labels) => {
  const i = (label: string) => labels.indexOf(label);
  return {
    gp: i('GP'),
    min: i('TOI'),
    pts: i('PTS'),
    reb: i('G'),
    ast: i('A'),
    stl: i('+/-'),
    blk: i('BLK'),
    fgPct: i('SV%'),
    fg3Pct: i('GAA'),
    ftPct: i('W'),
    to: i('L'),
  };
};

const SOCCER_LABELS: LabelIndexFn = (labels) => {
  const i = (label: string) => labels.indexOf(label);
  return {
    gp: i('GP'),
    min: i('MIN'),
    pts: i('G') >= 0 ? i('G') : i('GL'),
    reb: i('A'),
    ast: i('SH'),
    stl: i('SOT'),
    blk: i('YC'),
    fgPct: i('xG'),
    fg3Pct: i('npxG'),
    ftPct: i('PK'),
    to: i('PKatt'),
  };
};

function pickLabel(labels: string[], ...candidates: string[]): number {
  const normalized = labels.map((l) => l.trim().toUpperCase().replace(/[^A-Z0-9%+.]/g, ''));
  for (const c of candidates) {
    const nc = c.trim().toUpperCase().replace(/[^A-Z0-9%+.]/g, '');
    const exact = normalized.indexOf(nc);
    if (exact >= 0) return exact;
    const partial = normalized.findIndex((l) => l === nc || l.includes(nc) || nc.includes(l));
    if (partial >= 0) return partial;
  }
  return -1;
}

function labelIndex(labels: string[], ...candidates: string[]): number {
  const direct = labels.indexOf(candidates[0]);
  if (direct >= 0) return direct;
  return pickLabel(labels, ...candidates);
}

const TENNIS_LABELS: LabelIndexFn = (labels) => ({
  gp: pickLabel(labels, 'Events', 'GP', 'Tournaments'),
  min: pickLabel(labels, 'Matches', 'MIN', 'Match'),
  pts: pickLabel(labels, 'Wins', 'W', 'Win'),
  reb: pickLabel(labels, 'Losses', 'L', 'Loss'),
  ast: pickLabel(labels, 'Titles', 'T', 'Championships'),
  stl: pickLabel(labels, 'Rank', 'Ranking'),
  blk: -1,
  fgPct: pickLabel(labels, 'Win%', 'PCT'),
  fg3Pct: pickLabel(labels, 'Hard', 'Surface'),
  ftPct: -1,
  to: -1,
});

const GOLF_LABELS: LabelIndexFn = (labels) => ({
  gp: pickLabel(labels, 'Events', 'GP', 'Starts'),
  min: pickLabel(labels, 'Rounds', 'Round', 'Rd'),
  pts: pickLabel(labels, 'Rank', 'Ranking', 'FedEx'),
  reb: pickLabel(labels, 'Top 10', 'Top10', 'Top 25'),
  ast: pickLabel(labels, 'Wins', 'Win', 'Victories'),
  stl: pickLabel(labels, 'Earnings', 'Money'),
  blk: pickLabel(labels, 'Cuts Made', 'Cuts'),
  fgPct: pickLabel(labels, 'Scoring Avg', 'Avg', 'Score'),
  fg3Pct: pickLabel(labels, 'Drive Avg', 'Driving'),
  ftPct: pickLabel(labels, 'GIR', 'Greens'),
  to: -1,
});

const FIGHTS_LABELS: LabelIndexFn = (labels) => ({
  gp: pickLabel(labels, 'Fights', 'GP', 'Bouts'),
  min: -1,
  pts: pickLabel(labels, 'Wins', 'W', 'Win'),
  reb: pickLabel(labels, 'Losses', 'L', 'Loss'),
  ast: pickLabel(labels, 'Draws', 'D', 'NC'),
  stl: pickLabel(labels, 'KO', 'KO/TKO', 'KOs'),
  blk: pickLabel(labels, 'SUB', 'Subs', 'Submissions'),
  fgPct: pickLabel(labels, 'DEC', 'Decisions'),
  fg3Pct: pickLabel(labels, 'Win%', 'PCT'),
  ftPct: -1,
  to: -1,
});

const LABEL_BY_SPORT: Record<string, LabelIndexFn> = {
  nba: BASKETBALL_LABELS,
  wnba: BASKETBALL_LABELS,
  nfl: FOOTBALL_LABELS,
  mlb: BASEBALL_LABELS,
  nhl: HOCKEY_LABELS,
  mls: SOCCER_LABELS,
  epl: SOCCER_LABELS,
  tennis: TENNIS_LABELS,
  golf: GOLF_LABELS,
  fights: FIGHTS_LABELS,
};

/** ESPN stats payload uses different category names per sport. */
function pickStatsCategory(
  sportId: string,
  categories: Array<{ name?: string; labels?: string[]; statistics?: SeasonStatEntry[] }>,
  position?: string,
): { name?: string; labels?: string[]; statistics?: SeasonStatEntry[] } | undefined {
  if (!categories.length) return undefined;

  if (sportId === 'nba' || sportId === 'wnba') {
    return categories.find((c) => c.name === 'averages') ?? categories[0];
  }

  if (sportId === 'nfl') {
    const pos = (position ?? '').toUpperCase();
    const prefer =
      /QB/.test(pos) ? 'passing'
      : /RB|FB|HB/.test(pos) ? 'rushing'
      : /WR|TE/.test(pos) ? 'receiving'
      : /LB|DE|DT|CB|S|DB/.test(pos) ? 'defensive'
      : 'passing';
    return (
      categories.find((c) => c.name === prefer)
      ?? categories.find((c) => c.name === 'passing')
      ?? categories[0]
    );
  }

  if (sportId === 'mlb') {
    const pitcher = /\b(P|SP|RP|CP|LHP|RHP)\b/i.test(position ?? '');
    return categories.find((c) => c.name === (pitcher ? 'pitching' : 'hitting')) ?? categories[0];
  }

  if (sportId === 'nhl') {
    const goalie = /\b(G|GK)\b/i.test(position ?? '');
    return categories.find((c) => c.name === (goalie ? 'goaltending' : 'skating')) ?? categories[0];
  }

  if (sportId === 'mls' || sportId === 'epl') {
    const prefer = ['stats', 'season', 'attacking', 'overall', 'totals'];
    for (const name of prefer) {
      const found = categories.find((c) => c.name?.toLowerCase() === name);
      if (found?.statistics?.length) return found;
    }
    return categories.find((c) => c.labels?.includes('GP') || c.labels?.some((l) => l === 'G')) ?? categories[0];
  }

  if (sportId === 'fights' || sportId === 'tennis' || sportId === 'golf') {
    return (
      categories.find((c) => c.name === 'career' || c.name === 'overview')
      ?? categories.find((c) => c.name === 'totals')
      ?? categories[0]
    );
  }

  return categories.find((c) => c.name === 'averages') ?? categories[0];
}

type SeasonStatEntry = {
  stats?: (string | number)[];
  season?: { displayName?: string; year?: number };
  teamSlug?: string;
  displayName?: string;
};

/** Normalize stats / overview payloads (MMA stores stats on overview). */
export function coerceEspnStatsPayload(bundle: {
  stats?: unknown;
  overview?: unknown;
}): unknown {
  const stats = bundle.stats as { categories?: unknown[] } | null;
  if (stats?.categories?.length) return stats;

  const overview = bundle.overview as {
    statistics?: {
      categories?: unknown[];
      labels?: string[];
      splits?: Array<{ stats?: (string | number)[]; displayName?: string; season?: { displayName?: string; year?: number } }>;
    };
    stats?: { categories?: unknown[] };
    teams?: Record<string, unknown>;
  } | null;

  const oStats = overview?.statistics ?? overview?.stats;
  if (oStats && 'categories' in oStats && Array.isArray((oStats as { categories?: unknown[] }).categories) && (oStats as { categories: unknown[] }).categories.length) {
    return { categories: (oStats as { categories: unknown[] }).categories, teams: overview?.teams ?? {} };
  }

  const splitStats = oStats as {
    labels?: string[];
    splits?: Array<{ stats?: (string | number)[]; displayName?: string; season?: { displayName?: string; year?: number } }>;
  } | undefined;

  if (splitStats?.labels && splitStats.splits?.length) {
    return {
      categories: [
        {
          name: 'averages',
          labels: splitStats.labels,
          statistics: splitStats.splits.map((split) => ({
            stats: split.stats ?? [],
            season: split.season ?? { displayName: split.displayName ?? '' },
          })),
        },
      ],
      teams: overview?.teams ?? {},
    };
  }

  const nestedCategories = (oStats as { splits?: Array<{ categories?: unknown[] }> })?.splits;
  if (Array.isArray(nestedCategories) && nestedCategories[0]?.categories?.length) {
    return {
      categories: nestedCategories[0].categories,
      teams: overview?.teams ?? {},
    };
  }

  return stats ?? null;
}

export function parseEspnSeasonHistory(
  sportId: string,
  rawStats: unknown,
  position?: string,
): PlayerSeasonRow[] {
  const labelIndexFn = LABEL_BY_SPORT[sportId] ?? BASKETBALL_LABELS;
  const data = (rawStats ?? {}) as {
    categories?: Array<{
      name?: string;
      labels?: string[];
      statistics?: SeasonStatEntry[];
    }>;
    teams?: Record<string, { abbreviation?: string }>;
  };

  const block = pickStatsCategory(sportId, data.categories ?? [], position);
  if (!block?.statistics?.length || !Array.isArray(block.labels)) return [];

  const idx = labelIndexFn(block.labels);
  const teams = data.teams ?? {};

  return [...block.statistics].reverse().map((entry) => {
    const stats = entry.stats ?? [];
    const team = entry.teamSlug ? teams[entry.teamSlug] : undefined;
    return {
      season: entry.season?.displayName ?? String(entry.season?.year ?? ''),
      team: team?.abbreviation,
      ...rowFromIndices(stats, idx),
    };
  });
}

export function isMeaningfulSeasonRow(row: PlayerSeasonRow): boolean {
  if (row.season?.trim()) return true;
  const fields = [row.gp, row.min, row.pts, row.reb, row.ast, row.stl, row.blk, row.fgPct, row.fg3Pct, row.ftPct, row.to];
  return fields.some((v) => v && v !== '-');
}

export function filterMeaningfulSeasonRows(rows: PlayerSeasonRow[]): PlayerSeasonRow[] {
  return rows.filter(isMeaningfulSeasonRow);
}

export function parseTennisCareerRow(bio: unknown): PlayerSeasonRow | null {
  const athlete = (bio as { athlete?: Record<string, unknown> })?.athlete;
  if (!athlete?.displayName) return null;

  const rank = athlete.rank as { displayName?: string; summary?: string } | undefined;
  const rankVal = rank?.displayName ?? rank?.summary;
  const debut = athlete.debutYear;
  const season = debut ? `${debut}-${Number(debut) + 1}` : 'Career';
  const status = athlete.active === false ? 'Retired' : 'Active';

  return {
    season: String(season),
    gp: '-',
    min: '-',
    pts: '-',
    reb: '-',
    ast: '-',
    stl: rankVal ? String(rankVal) : status,
    blk: '-',
    fgPct: '-',
    fg3Pct: '-',
    ftPct: '-',
    to: '-',
  };
}

export function parseEspnGameLog(sportId: string, rawOverview: unknown): PlayerGameLogRow[] {
  const labelIndexFn = LABEL_BY_SPORT[sportId] ?? BASKETBALL_LABELS;
  const overview = (rawOverview ?? {}) as {
    gameLog?: {
      statistics?: Array<{
        labels?: string[];
        events?: Array<{ stats?: (string | number)[]; eventId?: string }>;
      }>;
      events?: Record<
        string,
        {
          opponent?: { abbreviation?: string; displayName?: string };
          gameDate?: string;
          score?: string;
          gameResult?: string;
          atVs?: string;
        }
      >;
    };
  };

  const gameLog = overview.gameLog;
  const totals = gameLog?.statistics?.[0];
  if (!totals?.labels || !totals.events) return [];

  const labels = totals.labels;
  const events = totals.events;
  const eventMap = gameLog?.events ?? {};
  const idx = labelIndexFn(labels);

  return events.slice(0, 15).map((entry) => {
    const stats = entry.stats ?? [];
    const meta = eventMap[entry.eventId ?? ''] ?? {};
    const opponent = meta.opponent?.abbreviation ?? meta.opponent?.displayName ?? 'OPP';
    const date = meta.gameDate
      ? new Date(meta.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';
    const scoreText = meta.score ?? '—';
    const result =
      meta.gameResult && scoreText !== '—' ? `${meta.gameResult} ${scoreText}` : String(scoreText);

    return {
      date,
      matchup: `${meta.atVs ?? ''} ${opponent}`.trim(),
      result,
      min: String(stats[idx.min] ?? '—'),
      pts: String(stats[idx.pts] ?? '—'),
      reb: String(stats[idx.reb] ?? '—'),
      ast: String(stats[idx.ast] ?? '—'),
      stl: String(stats[idx.stl] ?? '—'),
      blk: String(stats[idx.blk] ?? '—'),
    };
  });
}
