import { fetchJson } from '../../lib/http.js';
import { pickBestNameMatch, nameMatchScore } from '../../lib/normalize.js';
import type { SportConfig } from '../../types/siyf.js';
import { allEspnEndpointSets } from './config.js';

const ESPN_GLOBAL_SEARCH = 'https://site.api.espn.com/apis/common/v3/search';

export interface EspnAthleteBundle {
  bio: unknown;
  overview: unknown;
  stats: unknown;
}

export interface EspnSearchHit {
  id: string;
  name: string;
  position?: string;
  team?: string;
  headshot?: string;
  sport?: string;
}

export interface EspnSearchFilter {
  sport?: string;
  league?: string;
}

function athleteFromBio(bio: unknown): {
  id: string;
  name: string;
  position?: string;
  team?: string;
  headshot?: string;
} | null {
  const athlete = (bio as { athlete?: Record<string, unknown> })?.athlete ?? (bio as Record<string, unknown>);
  if (!athlete?.id && !athlete?.displayName) return null;
  const team = athlete.team as { abbreviation?: string } | undefined;
  const headshot = athlete.headshot as { href?: string } | string | undefined;
  return {
    id: String(athlete.id ?? ''),
    name: String(athlete.displayName ?? athlete.fullName ?? ''),
    position: (athlete.position as { abbreviation?: string } | undefined)?.abbreviation,
    team: team?.abbreviation,
    headshot: typeof headshot === 'object' ? headshot?.href : headshot,
  };
}

function matchesFilter(item: Record<string, unknown>, filter?: EspnSearchFilter): boolean {
  if (!filter) return true;
  const sport = String(item.sport ?? '').toLowerCase();
  const league = String(item.league ?? '').toLowerCase();
  if (filter.sport && sport !== filter.sport.toLowerCase()) return false;
  if (filter.league && league !== filter.league.toLowerCase()) return false;
  return true;
}

function hitFromGlobalItem(item: Record<string, unknown>): EspnSearchHit | null {
  const id = String(item.id ?? '');
  const name = String(item.displayName ?? item.shortName ?? item.fullName ?? '');
  if (!id || !name) return null;
  const team = item.team as { abbreviation?: string } | undefined;
  const position = item.position as { abbreviation?: string } | undefined;
  const headshot = item.headshot as { href?: string } | string | undefined;
  return {
    id,
    name,
    position: position?.abbreviation,
    team: team?.abbreviation,
    headshot: typeof headshot === 'object' ? headshot?.href : headshot,
    sport: String(item.sport ?? ''),
  };
}

/** ESPN global search — league `athletes?search=` often 400s (same as engine). */
export async function espnGlobalSearchPlayers(
  query: string,
  filter?: EspnSearchFilter,
): Promise<EspnSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const raw = await fetchJson<{ items?: Record<string, unknown>[] }>(
    `${ESPN_GLOBAL_SEARCH}?query=${encodeURIComponent(trimmed)}&limit=15&type=player`,
    { headers: { Accept: 'application/json' } },
  ).catch(() => null);

  const items = raw?.items ?? [];
  return items
    .filter((item) => item.id && matchesFilter(item, filter))
    .map((item) => hitFromGlobalItem(item))
    .filter((h): h is EspnSearchHit => Boolean(h));
}

const SEARCH_FILTER_CHAINS: Record<string, EspnSearchFilter[]> = {
  nba: [{ sport: 'basketball', league: 'nba' }, { sport: 'basketball' }],
  wnba: [{ sport: 'basketball', league: 'wnba' }, { sport: 'basketball' }],
  nfl: [{ sport: 'football', league: 'nfl' }, { sport: 'football' }],
  mlb: [{ sport: 'baseball', league: 'mlb' }, { sport: 'baseball' }],
  nhl: [{ sport: 'hockey', league: 'nhl' }, { sport: 'hockey' }],
  mls: [{ sport: 'soccer' }, { sport: 'soccer', league: 'usa.1' }],
  epl: [{ sport: 'soccer', league: 'eng.1' }, { sport: 'soccer' }],
  laliga: [{ sport: 'soccer', league: 'esp.1' }, { sport: 'soccer' }],
  bundesliga: [{ sport: 'soccer', league: 'ger.1' }, { sport: 'soccer' }],
  seriea: [{ sport: 'soccer', league: 'ita.1' }, { sport: 'soccer' }],
  ligue1: [{ sport: 'soccer', league: 'fra.1' }, { sport: 'soccer' }],
  ucl: [{ sport: 'soccer', league: 'uefa.champions' }, { sport: 'soccer' }],
  europa: [{ sport: 'soccer', league: 'uefa.europa' }, { sport: 'soccer' }],
  ligamx: [{ sport: 'soccer', league: 'mex.1' }, { sport: 'soccer' }],
  brasileirao: [{ sport: 'soccer', league: 'bra.1' }, { sport: 'soccer' }],
  eredivisie: [{ sport: 'soccer', league: 'ned.1' }, { sport: 'soccer' }],
  championship: [{ sport: 'soccer', league: 'eng.2' }, { sport: 'soccer' }],
  primeira: [{ sport: 'soccer', league: 'por.1' }, { sport: 'soccer' }],
  fights: [{ sport: 'mma' }],
  tennis: [{ sport: 'tennis' }, { sport: 'tennis', league: 'atp' }, { sport: 'tennis', league: 'wta' }],
  golf: [{ sport: 'golf' }, { sport: 'golf', league: 'pga' }],
};

const EXPECTED_ESPN_SPORT: Record<string, string[]> = {
  nba: ['basketball'],
  wnba: ['basketball'],
  nfl: ['football'],
  mlb: ['baseball'],
  nhl: ['hockey'],
  mls: ['soccer'],
  epl: ['soccer'],
  laliga: ['soccer'],
  bundesliga: ['soccer'],
  seriea: ['soccer'],
  ligue1: ['soccer'],
  ucl: ['soccer'],
  europa: ['soccer'],
  ligamx: ['soccer'],
  brasileirao: ['soccer'],
  eredivisie: ['soccer'],
  championship: ['soccer'],
  primeira: ['soccer'],
  fights: ['mma', 'boxing'],
  tennis: ['tennis'],
  golf: ['golf'],
};

function matchesExpectedSport(sportId: string, hitSport?: string): boolean {
  const expected = EXPECTED_ESPN_SPORT[sportId];
  if (!expected?.length || !hitSport) return true;
  return expected.includes(hitSport.toLowerCase());
}

async function fetchAthleteFromEndpoints(
  endpoints: SportConfig['espn'],
  athleteId: string,
): Promise<EspnAthleteBundle | null> {
  const base = endpoints.athleteBase ?? `${endpoints.commonBase}/athletes`;
  const opts = { headers: { Accept: 'application/json' } };

  const [bio, overview, stats] = await Promise.all([
    fetchJson<unknown>(`${base}/${athleteId}`, opts).catch(() => null),
    fetchJson<unknown>(`${base}/${athleteId}/overview`, opts).catch(() => null),
    fetchJson<unknown>(`${base}/${athleteId}/stats`, opts).catch(() => null),
  ]);

  if (!bio && !overview) {
    const siteV2 = await fetchJson<unknown>(`${endpoints.siteBase}/athletes/${athleteId}`, opts).catch(() => null);
    if (siteV2) return { bio: siteV2, overview: siteV2, stats };
    return null;
  }

  return { bio, overview, stats };
}

export async function fetchEspnAthlete(
  sport: SportConfig,
  athleteId: string,
): Promise<EspnAthleteBundle | null> {
  for (const endpoints of allEspnEndpointSets(sport)) {
    const bundle = await fetchAthleteFromEndpoints(endpoints, athleteId);
    if (bundle) return bundle;
  }
  return null;
}


export async function searchEspnAthletes(
  sport: SportConfig,
  query: string,
  limit = 10,
): Promise<EspnSearchHit[]> {
  const filters = SEARCH_FILTER_CHAINS[sport.id] ?? [];
  const seen = new Set<string>();
  const merged: EspnSearchHit[] = [];

  for (const filter of filters) {
    for (const hit of await espnGlobalSearchPlayers(query, filter)) {
      if (seen.has(hit.id)) continue;
      if (!matchesExpectedSport(sport.id, hit.sport)) continue;
      seen.add(hit.id);
      merged.push(hit);
    }
    if (merged.length >= limit) break;
  }

  const match = pickBestNameMatch(query, merged);
  if (!match || nameMatchScore(query, match.name) < 50) return [];

  return [match, ...merged.filter((h) => h.id !== match.id)].slice(0, limit);
}

export function extractAthleteMeta(bundle: EspnAthleteBundle): ReturnType<typeof athleteFromBio> {
  return athleteFromBio(bundle.bio) ?? athleteFromBio(bundle.overview);
}

export async function resolveEspnSearchHit(
  sport: SportConfig,
  name: string,
): Promise<EspnSearchHit | null> {
  const trimmed = name.trim();
  const queries = new Set<string>([trimmed]);

  const suffixMatch = trimmed.match(/^(.*)\s+(II|III|IV|Jr\.?)$/i);
  if (suffixMatch?.[1]) queries.add(suffixMatch[1].trim());

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    queries.add(parts[parts.length - 1]);
    if (parts.length >= 3) {
      queries.add(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
    }
    const first = parts[0].replace(/\.$/, '');
    if (first.length > 3) {
      queries.add(`${first.slice(0, 3)} ${parts.slice(1).join(' ')}`);
    }
  }

  for (const query of queries) {
    const hits = await searchEspnAthletes(sport, query, 12);
    const match = pickBestNameMatch(trimmed, hits);
    if (match) return match;
  }

  // Broad soccer fallback when league-filtered global search misses.
  if (EXPECTED_ESPN_SPORT[sport.id]?.includes('soccer')) {
    for (const query of queries) {
      const hits = await espnGlobalSearchPlayers(query);
      const soccerHits = hits.filter((h) => matchesExpectedSport(sport.id, h.sport));
      const match = pickBestNameMatch(trimmed, soccerHits);
      if (match) return match;
    }
  }

  return null;
}

export async function fetchEspnTeamRoster(
  sport: SportConfig,
  teamId: string,
): Promise<Array<{ id: string; name: string; position?: string; headshot?: string }>> {
  const raw = await fetchJson<{
    athletes?: Array<
      | {
          items?: Array<{
            id?: string | number;
            displayName?: string;
            position?: { abbreviation?: string };
            headshot?: { href?: string };
          }>;
        }
      | {
          id?: string | number;
          displayName?: string;
          position?: { abbreviation?: string };
          headshot?: { href?: string };
        }
    >;
  }>(`${sport.espn.siteBase}/teams/${teamId}/roster`, {
    headers: { Accept: 'application/json' },
  });

  const players: Array<{ id: string; name: string; position?: string; headshot?: string }> = [];

  for (const entry of raw.athletes ?? []) {
    if ('items' in entry && Array.isArray(entry.items)) {
      for (const item of entry.items) {
        const id = String(item.id ?? '');
        const name = String(item.displayName ?? '');
        if (!id || !name) continue;
        players.push({
          id,
          name,
          position: item.position?.abbreviation,
          headshot: item.headshot?.href,
        });
      }
      continue;
    }

    const flat = entry as {
      id?: string | number;
      displayName?: string;
      position?: { abbreviation?: string };
      headshot?: { href?: string };
    };
    const id = String(flat.id ?? '');
    const name = String(flat.displayName ?? '');
    if (!id || !name) continue;
    players.push({
      id,
      name,
      position: flat.position?.abbreviation,
      headshot: flat.headshot?.href,
    });
  }

  return players;
}

export async function fetchEspnTeams(
  sport: SportConfig,
): Promise<Array<{ id: string; abbr: string; name: string }>> {
  const raw = await fetchJson<{
    sports?: Array<{
      leagues?: Array<{
        teams?: Array<{ team?: { id?: string; abbreviation?: string; displayName?: string } }>;
      }>;
    }>;
  }>(`${sport.espn.siteBase}/teams`, { headers: { Accept: 'application/json' } });

  const teams: Array<{ id: string; abbr: string; name: string }> = [];
  for (const sportBlock of raw.sports ?? []) {
    for (const league of sportBlock.leagues ?? []) {
      for (const entry of league.teams ?? []) {
        const team = entry.team;
        if (!team?.id) continue;
        teams.push({
          id: String(team.id),
          abbr: String(team.abbreviation ?? ''),
          name: String(team.displayName ?? ''),
        });
      }
    }
  }
  return teams;
}
