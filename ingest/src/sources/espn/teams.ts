import { fetchJson } from '../../lib/http.js';
import { pickBestNameMatch, pickBestTeamNameMatch, normalizeName } from '../../lib/normalize.js';
import type { ResolvedTeam, TeamRecordSplit } from '../../types/team.js';
import type { SportConfig } from '../../types/siyf.js';
import { allEspnEndpointSets } from './config.js';

export interface EspnTeamRaw {
  id: string;
  abbr: string;
  name: string;
  city: string;
  color?: string;
  alternateColor?: string;
  logoUrl?: string;
}

export interface EspnTeamDetail extends EspnTeamRaw {
  standingSummary?: string;
  record?: TeamRecordSplit[];
  venue?: string;
  conference?: string;
  division?: string;
}

function hexColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.replace(/^#/, '').trim();
  return v ? `#${v}` : undefined;
}

function pickLogo(logos: Array<{ href?: string; rel?: string[] }> | undefined): string | undefined {
  if (!logos?.length) return undefined;
  const preferred = logos.find((l) => l.rel?.includes('default') && l.rel?.includes('full'));
  return preferred?.href ?? logos[0]?.href;
}

function parseTeamEntry(team: Record<string, unknown> | undefined): EspnTeamRaw | null {
  if (!team?.id) return null;
  const location = team.location;
  const city =
    typeof location === 'string'
      ? location
      : String((location as { city?: string } | undefined)?.city ?? '');
  return {
    id: String(team.id),
    abbr: String(team.abbreviation ?? '').toUpperCase(),
    name: String(team.displayName ?? team.name ?? ''),
    city,
    color: hexColor(String(team.color ?? '')),
    alternateColor: hexColor(String(team.alternateColor ?? '')),
    logoUrl: pickLogo(team.logos as Array<{ href?: string; rel?: string[] }>),
  };
}

function parseDivisionFromSummary(summary?: string): { conference?: string; division?: string } {
  if (!summary) return {};
  const divMatch = summary.match(/in\s+(.+?\s+Division)/i);
  const confMatch = summary.match(/in\s+(.+?\s+Conference)/i);
  return {
    division: divMatch?.[1],
    conference: confMatch?.[1],
  };
}

function parseRecordItems(record: { items?: Array<{ description?: string; summary?: string }> } | undefined): TeamRecordSplit[] {
  return (record?.items ?? [])
    .filter((item) => item.description && item.summary)
    .map((item) => ({ label: item.description!, summary: item.summary! }));
}

async function fetchTeamsPayload(sport: SportConfig): Promise<unknown> {
  for (const endpoints of allEspnEndpointSets(sport)) {
    const raw = await fetchJson<unknown>(`${endpoints.siteBase}/teams`, {
      headers: { Accept: 'application/json' },
    }).catch(() => null);
    if (raw) return raw;
  }
  return null;
}

/** All teams in a league from ESPN. */
export async function fetchEspnLeagueTeams(sport: SportConfig): Promise<EspnTeamRaw[]> {
  const raw = await fetchTeamsPayload(sport);
  const data = raw as {
    sports?: Array<{
      leagues?: Array<{
        teams?: Array<{ team?: Record<string, unknown> }>;
      }>;
    }>;
  };

  const teams: EspnTeamRaw[] = [];
  const seen = new Set<string>();

  for (const sportBlock of data?.sports ?? []) {
    for (const league of sportBlock.leagues ?? []) {
      for (const entry of league.teams ?? []) {
        const parsed = parseTeamEntry(entry.team);
        if (!parsed?.abbr || seen.has(parsed.abbr)) continue;
        seen.add(parsed.abbr);
        teams.push(parsed);
      }
    }
  }

  return teams;
}

export async function fetchEspnTeamDetail(
  sport: SportConfig,
  teamId: string,
): Promise<EspnTeamDetail | null> {
  for (const endpoints of allEspnEndpointSets(sport)) {
    const raw = await fetchJson<{ team?: Record<string, unknown> }>(
      `${endpoints.siteBase}/teams/${teamId}`,
      { headers: { Accept: 'application/json' } },
    ).catch(() => null);

    const base = parseTeamEntry(raw?.team);
    if (!base) continue;

    const team = raw!.team!;
    const franchise = team.franchise as { venue?: { fullName?: string } } | undefined;
    const parsed = parseDivisionFromSummary(String(team.standingSummary ?? ''));

    return {
      ...base,
      standingSummary: String(team.standingSummary ?? '') || undefined,
      record: parseRecordItems(team.record as { items?: Array<{ description?: string; summary?: string }> }),
      venue: franchise?.venue?.fullName,
      conference: parsed.conference,
      division: parsed.division,
    };
  }
  return null;
}

const TEAM_WANTED_ALIASES: Record<string, string> = {
  'los angeles fc': 'lafc',
};

export function resolveTeamByName(teams: EspnTeamRaw[], wantedName: string): EspnTeamRaw | null {
  const alias = TEAM_WANTED_ALIASES[normalizeName(wantedName)];
  if (alias) {
    const byAlias = teams.find((t) => normalizeName(t.name) === alias || t.abbr.toLowerCase() === alias);
    if (byAlias) return byAlias;
  }

  const byAbbr = teams.find(
    (t) => t.abbr.toUpperCase() === wantedName.replace(/\s+/g, '').toUpperCase(),
  );
  if (byAbbr) return byAbbr;

  const hits = teams.map((t) => ({ name: t.name, team: t }));
  const match = pickBestTeamNameMatch(
    wantedName,
    hits.map((h) => ({ name: h.name })),
  );
  if (!match) return null;
  return hits.find((h) => h.name === match.name)?.team ?? null;
}

export function toResolvedTeam(
  team: EspnTeamRaw,
  logoCdnPath: string,
  extra?: Partial<ResolvedTeam>,
): ResolvedTeam {
  return {
    id: team.abbr,
    espnId: team.id,
    name: team.name,
    abbr: team.abbr,
    city: team.city,
    logo: logoCdnPath,
    color: team.color,
    alternateColor: team.alternateColor,
    conference: extra?.conference,
    division: extra?.division,
    note: extra?.note,
  };
}
