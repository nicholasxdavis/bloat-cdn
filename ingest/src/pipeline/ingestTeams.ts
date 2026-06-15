import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { downloadTeamLogo } from '../lib/teamLogo.js';
import { pickBestTeamNameMatch } from '../lib/normalize.js';
import { cdnTeamsRegistryPath, loadTeamIndex } from '../lib/teamIndex.js';
import type { TeamIndexEntry } from '../types/team.js';
import type { NeedTeamItem } from '../lib/needTeamList.js';
import { repoPath } from '../lib/publish.js';
import { getSport } from '../sources/espn/config.js';
import { fetchEspnTeamRoster } from '../sources/espn/fetch.js';
import {
  fetchEspnLeagueTeams,
  fetchEspnTeamDetail,
  resolveTeamByName,
  toResolvedTeam,
} from '../sources/espn/teams.js';
import type { ResolvedTeam, TeamVault } from '../types/team.js';

const REGISTRY_SPORTS = new Set(['nba', 'nfl', 'mlb', 'nhl', 'mls', 'epl']);

function publishedRegistryPath(sportId: string): string {
  return repoPath('published', 'teams', `${sportId}.json`);
}

function vaultTeamPath(sportId: string, abbr: string): string {
  return repoPath('vault', sportId, 'teams', `${abbr.toLowerCase()}.json`);
}

function cdnVaultTeamPath(sportId: string, abbr: string): string {
  return `vault/${sportId}/teams/${abbr.toLowerCase()}.json`;
}

async function loadExistingRegistry(sportId: string): Promise<ResolvedTeam[]> {
  try {
    const raw = await readFile(publishedRegistryPath(sportId), 'utf8');
    return JSON.parse(raw) as ResolvedTeam[];
  } catch {
    return [];
  }
}

/** Build / merge engine registry `published/teams/{sport}.json` from ESPN league feed. */
export async function buildTeamRegistry(
  sportId: string,
  forceLogos = false,
): Promise<{ count: number; path: string }> {
  if (!REGISTRY_SPORTS.has(sportId)) {
    throw new Error(`Unsupported registry sport: ${sportId}`);
  }

  const sport = getSport(sportId);
  const leagueTeams = await fetchEspnLeagueTeams(sport);
  const existing = await loadExistingRegistry(sportId);
  const existingByAbbr = new Map(existing.map((t) => [t.abbr.toUpperCase(), t]));

  const resolved: ResolvedTeam[] = [];

  for (const team of leagueTeams) {
    let logoCdn = existingByAbbr.get(team.abbr)?.logo ?? '';
    if (team.logoUrl) {
      const logo = await downloadTeamLogo(sportId, team.abbr, team.logoUrl, forceLogos);
      if (logo) logoCdn = logo.cdnPath;
    }
    if (!logoCdn && team.abbr) {
      logoCdn = `media/logos/${sportId}/${team.abbr.toLowerCase()}.png`;
    }

    const prev = existingByAbbr.get(team.abbr);
    resolved.push(
      toResolvedTeam(team, logoCdn, {
        conference: prev?.conference,
        division: prev?.division,
        note: prev?.note,
      }),
    );
  }

  resolved.sort((a, b) => a.name.localeCompare(b.name));
  await mkdir(path.dirname(publishedRegistryPath(sportId)), { recursive: true });
  await writeFile(publishedRegistryPath(sportId), `${JSON.stringify(resolved, null, 2)}\n`, 'utf8');

  return { count: resolved.length, path: publishedRegistryPath(sportId) };
}

export interface IngestTeamResult {
  ok: boolean;
  error?: string;
  name: string;
  abbr: string;
  espnId?: string;
  registryPath?: string;
  vaultPath?: string;
  indexEntry?: TeamIndexEntry;
}

export async function ingestTeam(
  item: NeedTeamItem,
  opts?: { skipVault?: boolean; forceLogo?: boolean; leagueTeams?: Awaited<ReturnType<typeof fetchEspnLeagueTeams>> },
): Promise<IngestTeamResult> {
  const base = { ok: false, name: item.name, abbr: '' };

  try {
    if (!REGISTRY_SPORTS.has(item.sportId)) {
      throw new Error(`Unsupported sport: ${item.sportId}`);
    }

    const sport = getSport(item.sportId);
    const leagueTeams = opts?.leagueTeams ?? (await fetchEspnLeagueTeams(sport));
    const index = await loadTeamIndex();
    const sportIndexed = index.teams.filter((t) => t.sport === item.sportId);
    const already = pickBestTeamNameMatch(item.name, sportIndexed);
    const match =
      resolveTeamByName(leagueTeams, item.name)
      ?? (already ? leagueTeams.find((t) => t.abbr === already.abbr) : null);
    if (!match) throw new Error(`No ESPN team match for "${item.name}"`);

    let logoCdn = `media/logos/${item.sportId}/${match.abbr.toLowerCase()}.png`;
    if (match.logoUrl) {
      const logo = await downloadTeamLogo(item.sportId, match.abbr, match.logoUrl, opts?.forceLogo);
      if (logo) logoCdn = logo.cdnPath;
    }

    const detail = await fetchEspnTeamDetail(sport, match.id);
    const resolved = toResolvedTeam(detail ?? match, logoCdn, {
      conference: detail?.conference,
      division: detail?.division,
    });

    // Patch registry entry for this team
    const registry = await loadExistingRegistry(item.sportId);
    const byAbbr = new Map(registry.map((t) => [t.abbr.toUpperCase(), t]));
    byAbbr.set(resolved.abbr.toUpperCase(), resolved);
    const merged = [...byAbbr.values()].sort((a, b) => a.name.localeCompare(b.name));
    await mkdir(path.dirname(publishedRegistryPath(item.sportId)), { recursive: true });
    await writeFile(publishedRegistryPath(item.sportId), `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

    let vaultPath: string | undefined;
    if (!opts?.skipVault) {
      const roster = await fetchEspnTeamRoster(sport, match.id).catch(() => []);
      const vault: TeamVault = {
        id: resolved.id,
        espnId: match.id,
        abbr: match.abbr,
        name: match.name,
        city: match.city,
        sport: item.sportId,
        logo: logoCdn,
        logoSource: match.logoUrl,
        color: resolved.color,
        alternateColor: resolved.alternateColor,
        conference: resolved.conference,
        division: resolved.division,
        standingSummary: detail?.standingSummary,
        record: detail?.record,
        venue: detail?.venue,
        roster,
        tier: item.tier,
        top10: item.top10,
        sources: ['espn'],
        ingestedAt: new Date().toISOString(),
      };

      vaultPath = vaultTeamPath(item.sportId, match.abbr);
      await mkdir(path.dirname(vaultPath), { recursive: true });
      await writeFile(vaultPath, `${JSON.stringify(vault, null, 2)}\n`, 'utf8');
    }

    const indexEntry: TeamIndexEntry = {
      sport: item.sportId,
      name: match.name,
      abbr: match.abbr,
      espnId: match.id,
      tier: item.tier,
      top10: item.top10,
      logo: logoCdn,
      registryPath: cdnTeamsRegistryPath(item.sportId),
      vaultPath: vaultPath ? cdnVaultTeamPath(item.sportId, match.abbr) : undefined,
      ingestedAt: new Date().toISOString(),
    };

    return {
      ok: true,
      name: match.name,
      abbr: match.abbr,
      espnId: match.id,
      registryPath: publishedRegistryPath(item.sportId),
      vaultPath,
      indexEntry,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function ingestTeamSport(
  sportId: string,
  items: NeedTeamItem[],
  opts?: { force?: boolean; forceLogo?: boolean },
): Promise<void> {
  if (!items.length) return;

  console.log(`  Building ${sportId} registry…`);
  await buildTeamRegistry(sportId, opts?.forceLogo);

  const sport = getSport(sportId);
  const leagueTeams = await fetchEspnLeagueTeams(sport);

  for (const item of items) {
    await ingestTeam(item, { leagueTeams, forceLogo: opts?.forceLogo });
  }
}
