import { fetchText, FetchError, isHtmlPayload } from '../../lib/http.js';
import { pfrSlugCandidates, sportsReferenceSlug } from '../../lib/slug.js';
import type { PlayerSeasonRow } from '../../types/siyf.js';
import { getSport } from '../espn/config.js';
import type { SportConfig } from '../../types/siyf.js';
import {
  BBREF_MAP,
  BREF_BATTING_MAP,
  BREF_PITCHING_MAP,
  FBREF_MAP,
  HREF_GOALIE_MAP,
  HREF_SKATER_MAP,
  PFR_DEFENSE_MAP,
  PFR_PASSING_MAP,
  PFR_RECEIVING_MAP,
  PFR_RUSHING_MAP,
  parseMappedCsv,
} from './csv.js';

export interface SportsRefIngestInput {
  sportId: string;
  playerId?: string;
  playerName: string;
  position?: string;
  slug?: string;
}

function isPitcher(position: string): boolean {
  return /\b(P|SP|RP|CP|LHP|RHP)\b/i.test(position);
}

function isGoalie(position: string): boolean {
  return /\b(G|GK|Goalie|Goaltender)\b/i.test(position);
}

function footballStatTypes(position: string): string[] {
  const pos = position.toUpperCase();
  if (/QB/.test(pos)) return ['passing'];
  if (/RB|FB|HB/.test(pos)) return ['rushing', 'receiving'];
  if (/WR|TE/.test(pos)) return ['receiving', 'rushing'];
  if (/LB|DE|DT|CB|S|DB|OL|OT|OG|C|G|T/.test(pos)) return ['defense', 'receiving'];
  return ['passing', 'rushing', 'receiving'];
}

const PFR_MAPS: Record<string, typeof PFR_PASSING_MAP> = {
  passing: PFR_PASSING_MAP,
  rushing: PFR_RUSHING_MAP,
  receiving: PFR_RECEIVING_MAP,
  defense: PFR_DEFENSE_MAP,
};

async function fetchSportsRefCsv(url: string): Promise<string | null> {
  try {
    const text = await fetchText(url, {
      headers: { Accept: 'text/csv,text/plain,*/*' },
    });
    if (isHtmlPayload(text)) return null;
    return text;
  } catch (err) {
    if (err instanceof FetchError && err.status === 403) {
      return null;
    }
    throw err;
  }
}

async function fetchBbrefHistory(slug: string): Promise<PlayerSeasonRow[]> {
  const letter = slug[0];
  const csv = await fetchSportsRefCsv(
    `https://www.basketball-reference.com/players/${letter}/${slug}/per_game.csv`,
  );
  return csv ? parseMappedCsv(csv, BBREF_MAP) : [];
}

async function fetchBrefHistory(slug: string, position: string): Promise<PlayerSeasonRow[]> {
  const statType = isPitcher(position) ? 'pitching' : 'batting';
  const mapping = statType === 'pitching' ? BREF_PITCHING_MAP : BREF_BATTING_MAP;
  const letter = slug[0];
  const csv = await fetchSportsRefCsv(
    `https://www.baseball-reference.com/players/${letter}/${slug}/${statType}.csv`,
  );
  return csv ? parseMappedCsv(csv, mapping) : [];
}

async function fetchHrefHistory(slug: string, position: string): Promise<PlayerSeasonRow[]> {
  const statType = isGoalie(position) ? 'goalie' : 'skaters';
  const mapping = statType === 'goalie' ? HREF_GOALIE_MAP : HREF_SKATER_MAP;
  const letter = slug[0];
  const csv = await fetchSportsRefCsv(
    `https://www.hockey-reference.com/players/${letter}/${slug}/${statType}.csv`,
  );
  return csv ? parseMappedCsv(csv, mapping) : [];
}

async function fetchPfrHistory(slug: string, position: string): Promise<PlayerSeasonRow[]> {
  const letter = slug[0];
  for (const statType of footballStatTypes(position)) {
    const csv = await fetchSportsRefCsv(
      `https://www.pro-football-reference.com/players/${letter}/${slug}/${statType}.csv`,
    );
    if (!csv) continue;
    const map = PFR_MAPS[statType];
    const parsed = parseMappedCsv(csv, map);
    if (parsed.length) return parsed;
  }
  return [];
}

async function resolveFbrefPlayerPath(playerName: string): Promise<string | null> {
  const html = await fetchText(
    `https://fbref.com/en/search/search.fcgi?search=${encodeURIComponent(playerName)}`,
    { headers: { Accept: 'text/html,*/*' } },
  );
  const match = html.match(/href="(\/en\/players\/[a-f0-9]{8}\/[^"]+)"/i);
  return match?.[1] ?? null;
}

async function fetchFbrefHistory(playerName: string): Promise<PlayerSeasonRow[]> {
  const path = await resolveFbrefPlayerPath(playerName);
  if (!path) return [];

  const csvCandidates = [
    `https://fbref.com${path}/summary.csv`,
    `https://fbref.com${path}/all_comps.csv`,
    `https://fbref.com${path}/summary/summary.csv`,
  ];

  for (const url of csvCandidates) {
    const csv = await fetchSportsRefCsv(url);
    if (!csv) continue;
    const parsed = parseMappedCsv(csv, FBREF_MAP, 0, 2);
    if (parsed.length) return parsed;
  }
  return [];
}

export function resolveSportsRefSlug(input: SportsRefIngestInput, sport: SportConfig): string | null {
  if (input.slug) return input.slug;
  if (sport.id === 'nfl') {
    const candidates = pfrSlugCandidates(input.playerId ?? '', input.playerName);
    return candidates[0] ?? null;
  }
  return sportsReferenceSlug(input.playerId, input.playerName, sport.id === 'nfl');
}

/** Fetch career season rows from the appropriate *-reference.com site. */
export async function fetchSportsRefSeasonHistory(
  input: SportsRefIngestInput,
): Promise<{ rows: PlayerSeasonRow[]; slug: string | null; source: string }> {
  const sport = getSport(input.sportId);
  const slug = resolveSportsRefSlug(input, sport);
  if (!slug && sport.id !== 'mls' && sport.id !== 'epl') {
    return { rows: [], slug: null, source: 'sportsref' };
  }

  switch (sport.id) {
    case 'nba':
    case 'wnba':
      return { rows: await fetchBbrefHistory(slug!), slug, source: 'basketball_reference' };
    case 'mlb':
      return {
        rows: await fetchBrefHistory(slug!, input.position ?? ''),
        slug: `${slug}-${isPitcher(input.position ?? '') ? 'pitching' : 'batting'}`,
        source: 'baseball_reference',
      };
    case 'nhl':
      return {
        rows: await fetchHrefHistory(slug!, input.position ?? ''),
        slug: `${slug}-${isGoalie(input.position ?? '') ? 'goalie' : 'skaters'}`,
        source: 'hockey_reference',
      };
    case 'nfl': {
      const candidates = input.slug
        ? [input.slug]
        : pfrSlugCandidates(input.playerId ?? '', input.playerName);
      for (const candidate of candidates) {
        const rows = await fetchPfrHistory(candidate, input.position ?? '');
        if (rows.length) return { rows, slug: candidate, source: 'pro_football_reference' };
      }
      return { rows: [], slug: candidates[0] ?? null, source: 'pro_football_reference' };
    }
    case 'mls':
    case 'epl':
      return { rows: await fetchFbrefHistory(input.playerName), slug: null, source: 'fbref' };
    default:
      return { rows: [], slug, source: 'sportsref' };
  }
}
