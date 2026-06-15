import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchJson } from './http.js';
import { getSport, SPORTS } from '../sources/espn/config.js';
import { repoPath } from './publish.js';

export type SeasonPhase = 'preseason' | 'regular' | 'postseason' | 'offseason' | 'year_round';

export interface SportSeasonStatus {
  sportId: string;
  phase: SeasonPhase;
  inSeason: boolean;
  nightlyEligible: boolean;
  weeklyEligible: boolean;
  reason: string;
  checkedAt: string;
  espnSeasonType?: number;
  recentEvents?: number;
}

/** Month windows (0-indexed) when games typically matter for nightly stat sync. */
const HEURISTIC_WINDOWS: Record<string, Array<[number, number]>> = {
  nba: [[9, 6]],       // Oct–Jun
  wnba: [[4, 9]],      // May–Oct
  nfl: [[8, 1]],       // Sep–Feb
  mlb: [[3, 9]],       // Apr–Oct
  nhl: [[9, 5]],       // Oct–Jun
  mls: [[1, 10]],      // Feb–Nov
  epl: [[7, 4]],       // Aug–May
};

const YEAR_ROUND_SPORTS = new Set(['fights', 'tennis', 'golf']);

/** Months (0-indexed) where nightly stat sync is always skipped — regardless of ESPN. */
const HARD_OFFSEASON_MONTHS: Record<string, number[]> = {
  nba: [5, 6, 7, 8, 9], // Jun–Oct (post-finals through pre-season)
  wnba: [10, 11, 0, 1, 2, 3], // Nov–Apr
  nfl: [2, 3, 4, 5, 6, 7, 8], // Mar–Sep
  mlb: [11, 0, 1, 2], // Dec–Mar
  nhl: [6, 7, 8], // Jul–Sep
  mls: [11, 0], // Dec–Jan
  epl: [5, 6, 7], // Jun–Aug
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isHardOffseason(sportId: string, at: Date): boolean {
  const months = HARD_OFFSEASON_MONTHS[sportId];
  if (!months) return false;
  return months.includes(at.getUTCMonth());
}

function monthInWindow(month: number, windows: Array<[number, number]>): boolean {
  for (const [start, end] of windows) {
    if (start <= end) {
      if (month >= start && month <= end) return true;
    } else if (month >= start || month <= end) {
      return true;
    }
  }
  return false;
}

function heuristicInSeason(sportId: string, at: Date): boolean {
  if (YEAR_ROUND_SPORTS.has(sportId)) return true;
  const windows = HEURISTIC_WINDOWS[sportId];
  if (!windows) return true;
  return monthInWindow(at.getUTCMonth(), windows);
}

interface ScoreboardProbe {
  seasonType?: number;
  eventCount: number;
}

async function probeEspnScoreboard(sportId: string): Promise<ScoreboardProbe | null> {
  try {
    const sport = getSport(sportId);
    const raw = await fetchJson<{
      season?: { type?: number };
      leagues?: Array<{ season?: { type?: number } }>;
      events?: unknown[];
    }>(`${sport.espn.siteBase}/scoreboard`, {
      headers: { Accept: 'application/json' },
    });
    const seasonType = raw.season?.type ?? raw.leagues?.[0]?.season?.type;
    return {
      seasonType: typeof seasonType === 'number' ? seasonType : undefined,
      eventCount: raw.events?.length ?? 0,
    };
  } catch {
    return null;
  }
}

function phaseFromEspn(seasonType?: number): SeasonPhase {
  if (seasonType === 1) return 'preseason';
  if (seasonType === 2) return 'regular';
  if (seasonType === 3) return 'postseason';
  return 'offseason';
}

/**
 * Decide if nightly stat sync should run for a sport.
 * Calendar hard-off months take priority over ESPN (avoids stale postseason flags in summer).
 */
export async function getSportSeasonStatus(
  sportId: string,
  at = new Date(),
): Promise<SportSeasonStatus> {
  const checkedAt = at.toISOString();
  const month = at.getUTCMonth();

  if (YEAR_ROUND_SPORTS.has(sportId)) {
    return {
      sportId,
      phase: 'year_round',
      inSeason: true,
      nightlyEligible: true,
      weeklyEligible: true,
      reason: 'year-round sport',
      checkedAt,
    };
  }

  if (isHardOffseason(sportId, at)) {
    return {
      sportId,
      phase: 'offseason',
      inSeason: false,
      nightlyEligible: false,
      weeklyEligible: true,
      reason: `hard off-season (${MONTH_NAMES[month]})`,
      checkedAt,
    };
  }

  const heuristic = heuristicInSeason(sportId, at);
  if (!heuristic) {
    return {
      sportId,
      phase: 'offseason',
      inSeason: false,
      nightlyEligible: false,
      weeklyEligible: true,
      reason: 'outside typical season calendar',
      checkedAt,
    };
  }

  const probe = await probeEspnScoreboard(sportId);
  const phase = phaseFromEspn(probe?.seasonType);
  const espnNote = probe?.seasonType != null ? `ESPN season type ${probe.seasonType}` : 'calendar window';

  return {
    sportId,
    phase: phase === 'offseason' ? 'regular' : phase,
    inSeason: true,
    nightlyEligible: true,
    weeklyEligible: true,
    reason: `in-season — ${espnNote}`,
    checkedAt,
    espnSeasonType: probe?.seasonType,
    recentEvents: probe?.eventCount,
  };
}

export async function getAllSportSeasonStatuses(at = new Date()): Promise<SportSeasonStatus[]> {
  const sportIds = [...new Set(Object.keys(SPORTS))];
  const statuses: SportSeasonStatus[] = [];
  for (const sportId of sportIds) {
    statuses.push(await getSportSeasonStatus(sportId, at));
  }
  return statuses;
}

export async function sportsEligibleForNightly(
  sportFilter?: string[],
  at = new Date(),
): Promise<{ eligible: string[]; statuses: SportSeasonStatus[] }> {
  const force = process.env.BLOAT_FORCE_SPORTS?.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) ?? [];
  const statuses = await getAllSportSeasonStatuses(at);
  const eligible = statuses
    .filter((s) => {
      if (sportFilter?.length && !sportFilter.includes(s.sportId)) return false;
      if (force.includes(s.sportId)) return true;
      return s.nightlyEligible;
    })
    .map((s) => s.sportId);
  return { eligible, statuses };
}

const SEASON_STATUS_PATH = () => repoPath('published', 'meta', 'season-status.json');

export async function writeSeasonStatus(statuses: SportSeasonStatus[]): Promise<void> {
  await mkdir(path.dirname(SEASON_STATUS_PATH()), { recursive: true });
  await writeFile(
    SEASON_STATUS_PATH(),
    `${JSON.stringify({ syncedAt: new Date().toISOString(), sports: statuses }, null, 2)}\n`,
    'utf8',
  );
}

export async function loadSeasonStatus(): Promise<SportSeasonStatus[] | null> {
  try {
    const raw = await readFile(SEASON_STATUS_PATH(), 'utf8');
    const data = JSON.parse(raw) as { sports?: SportSeasonStatus[] };
    return data.sports ?? null;
  } catch {
    return null;
  }
}
