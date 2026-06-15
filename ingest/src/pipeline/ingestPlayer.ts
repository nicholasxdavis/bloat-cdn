import { downloadPlayerHeadshot } from '../lib/headshot.js';
import { resolveLegendEspnId } from '../lib/legendIds.js';
import { cdnVaultPath, publishPlayerSeasonHistory } from '../lib/publish.js';
import { upsertPlayerIndex, type PlayerIndexEntry } from '../lib/playerIndex.js';
import { pfrSlugCandidates, sportsReferenceSlug } from '../lib/slug.js';
import type { PlayerSeasonRow, PlayerVault } from '../types/siyf.js';
import { getSport } from '../sources/espn/config.js';
import {
  extractAthleteMeta,
  fetchEspnAthlete,
  resolveEspnSearchHit,
  type EspnAthleteBundle,
} from '../sources/espn/fetch.js';
import { fetchMmaCoreCareerRow } from '../sources/espn/mmaRecords.js';
import {
  coerceEspnStatsPayload,
  filterMeaningfulSeasonRows,
  parseEspnGameLog,
  parseEspnSeasonHistory,
  parseTennisCareerRow,
} from '../sources/espn/parse.js';
import { fetchSportsRefSeasonHistory } from '../sources/sportsref/fetch.js';
import { fetchSherdogSeasonHistory } from '../sources/sherdog/fetch.js';

export type IngestSource = 'espn' | 'sportsref' | 'auto';

export interface IngestPlayerInput {
  sportId: string;
  espnId?: string;
  name?: string;
  slug?: string;
  position?: string;
  source?: IngestSource;
  skipHeadshot?: boolean;
  forceHeadshot?: boolean;
  legend?: boolean;
  /** Skip player-index / manifest touch (batch runner updates once at end). */
  skipIndex?: boolean;
}

export interface IngestPlayerResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  name: string;
  espnId?: string;
  slug: string;
  rowCount: number;
  sources: string[];
  publishedPath?: string;
  vaultPath?: string;
  statsPath?: string;
  headshotPath?: string;
}

function pickSlug(
  sportId: string,
  espnOnly: boolean | undefined,
  playerId: string | undefined,
  playerName: string,
  explicit?: string,
): string {
  if (explicit) return explicit.toLowerCase();
  if (espnOnly && playerId && /^\d+$/.test(playerId)) return playerId;
  if (sportId === 'nfl') {
    const candidates = pfrSlugCandidates(playerId ?? '', playerName);
    if (candidates[0]) return candidates[0].toLowerCase();
  }
  const derived = sportsReferenceSlug(playerId, playerName, sportId === 'nfl');
  if (!derived) throw new Error(`Could not derive slug for "${playerName}"`);
  return derived.toLowerCase();
}

function rowsFromEspn(
  sportId: string,
  bundle: EspnAthleteBundle,
  position?: string,
): PlayerSeasonRow[] {
  const payload = coerceEspnStatsPayload(bundle);
  const rows = parseEspnSeasonHistory(sportId, payload, position);
  return filterMeaningfulSeasonRows(rows);
}

async function rowsFromFights(
  athleteId: string,
  playerName: string,
  bundle: EspnAthleteBundle,
): Promise<{ rows: PlayerSeasonRow[]; source: string }> {
  const espnRows = rowsFromEspn('fights', bundle);
  if (espnRows.length) return { rows: espnRows, source: 'espn' };

  const sherdog = await fetchSherdogSeasonHistory(playerName);
  if (sherdog.length) return { rows: sherdog, source: 'sherdog' };

  const career = await fetchMmaCoreCareerRow(athleteId);
  if (career) return { rows: [career], source: 'espn_mma_core' };

  return { rows: [], source: '' };
}

export async function ingestPlayer(input: IngestPlayerInput): Promise<IngestPlayerResult> {
  const base = {
    ok: false,
    name: input.name ?? input.espnId ?? 'unknown',
    slug: '',
    rowCount: 0,
    sources: [] as string[],
  };

  try {
    const sport = getSport(input.sportId);
    const source = input.source ?? 'auto';
    const nameOnly = source === 'sportsref' && !input.espnId;

    let player: {
      id: string;
      name: string;
      position?: string;
      team?: string;
      headshot?: string;
    };

    if (input.espnId) {
      player = { id: input.espnId, name: input.name ?? input.espnId };
    } else if (!input.name) {
      throw new Error('Provide espnId or name');
    } else if (nameOnly) {
      player = { id: input.name.toLowerCase().replace(/\s+/g, '-'), name: input.name };
    } else {
      const legendId = resolveLegendEspnId(input.sportId, input.name);
      if (legendId) {
        player = { id: legendId, name: input.name };
      } else {
        const hit = await resolveEspnSearchHit(sport, input.name);
        if (!hit) throw new Error(`No ESPN match for "${input.name}"`);
        player = hit;
      }
    }

    base.name = player.name;

    let espnBundle: EspnAthleteBundle | null = null;
    if (/^\d+$/.test(player.id) && source !== 'sportsref') {
      espnBundle = await fetchEspnAthlete(sport, player.id);
      const meta = espnBundle ? extractAthleteMeta(espnBundle) : null;
      if (meta) {
        player = {
          ...player,
          name: meta.name || player.name,
          position: meta.position ?? player.position,
          team: meta.team ?? player.team,
          headshot: meta.headshot ?? player.headshot,
        };
        base.name = player.name;
      }
    }

    let rows: PlayerSeasonRow[] = [];
    const sources: string[] = [];
    let slug = pickSlug(sport.id, sport.espnOnly, player.id, player.name, input.slug);

    if ((source === 'espn' || source === 'auto') && espnBundle) {
      if (sport.id === 'fights' && /^\d+$/.test(player.id)) {
        const fightRows = await rowsFromFights(player.id, player.name, espnBundle);
        if (fightRows.rows.length) {
          rows = fightRows.rows;
          sources.push(fightRows.source);
        }
      } else {
        const espnRows = rowsFromEspn(sport.id, espnBundle, player.position ?? input.position);
        if (espnRows.length) {
          rows = espnRows;
          sources.push('espn');
        } else if (sport.id === 'tennis') {
          const career = parseTennisCareerRow(espnBundle.bio);
          if (career) {
            rows = [career];
            sources.push('espn');
          }
        }
      }
    }

    if (!rows.length && (source === 'sportsref' || source === 'auto') && !sport.espnOnly) {
      const ref = await fetchSportsRefSeasonHistory({
        sportId: sport.id,
        playerId: player.id,
        playerName: player.name,
        position: input.position ?? player.position,
        slug: input.slug,
      });
      if (ref.rows.length) {
        rows = ref.rows;
        sources.push(ref.source);
        if (ref.slug) slug = ref.slug.toLowerCase();
      }
    }

    if (!rows.length) {
      throw new Error(`No season history for ${player.name}`);
    }

    const recentGames = espnBundle?.overview
      ? parseEspnGameLog(sport.id, espnBundle.overview)
      : undefined;

    let headshotPath: string | undefined;
    let headshotSource: string | undefined;
    if (!input.skipHeadshot && /^\d+$/.test(player.id)) {
      const headshot = await downloadPlayerHeadshot({
        sportId: sport.id,
        slug,
        sourceUrl: player.headshot,
        espnId: player.id,
        headshotFolder: sport.espn.headshotFolder,
        force: input.forceHeadshot,
      });
      if (headshot) {
        headshotPath = headshot.cdnPath;
        headshotSource = headshot.sourceUrl;
      }
    }

    const vault: PlayerVault = {
      id: slug,
      espnId: /^\d+$/.test(player.id) ? player.id : undefined,
      slug,
      name: player.name,
      sport: sport.id,
      position: player.position ?? input.position,
      team: player.team,
      headshot: headshotPath,
      headshotSource,
      legend: input.legend ?? false,
      seasonHistory: rows,
      recentGames,
      sources,
      ingestedAt: '',
    };

    const published = await publishPlayerSeasonHistory(sport.cdnPrefix, slug, sport.id, vault, rows);

    if (!input.skipIndex) {
      const indexEntry: PlayerIndexEntry = {
        sport: sport.id,
        name: player.name,
        slug,
        espnId: vault.espnId,
        legend: input.legend ?? false,
        headshot: headshotPath,
        statsPath: published.statsPath,
        vaultPath: cdnVaultPath(sport.id, player.name),
        rowCount: published.rowCount,
        sources,
        ingestedAt: new Date().toISOString(),
      };
      await upsertPlayerIndex(indexEntry);
    }

    return {
      ok: true,
      name: player.name,
      espnId: vault.espnId,
      slug,
      rowCount: published.rowCount,
      sources,
      publishedPath: published.publishedPath,
      vaultPath: published.vaultPath,
      statsPath: published.statsPath,
      headshotPath,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
