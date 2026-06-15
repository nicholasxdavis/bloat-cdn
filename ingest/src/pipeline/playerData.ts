import { resolveLegendEspnId } from '../lib/legendIds.js';
import type { PlayerIndexEntry } from '../lib/playerIndex.js';
import type { PlayerGameLogRow, PlayerSeasonRow } from '../types/siyf.js';
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
import { extractPlayerDetails } from '../sources/espn/details.js';
import type { PlayerProfileFields } from '../lib/diff.js';
import type { PlayerDetails } from '../types/siyf.js';

export interface PlayerSnapshot {
  profile: PlayerProfileFields;
  details: PlayerDetails;
  seasonHistory: PlayerSeasonRow[];
  recentGames: PlayerGameLogRow[];
  sources: string[];
  bundle: EspnAthleteBundle | null;
}

function metaActive(bio: unknown): boolean | undefined {
  const athlete = (bio as { athlete?: { active?: boolean } })?.athlete;
  if (typeof athlete?.active === 'boolean') return athlete.active;
  return undefined;
}

async function rowsFromFights(
  athleteId: string,
  playerName: string,
  bundle: EspnAthleteBundle,
): Promise<{ rows: PlayerSeasonRow[]; source: string }> {
  const payload = coerceEspnStatsPayload(bundle);
  const espnRows = filterMeaningfulSeasonRows(parseEspnSeasonHistory('fights', payload));
  if (espnRows.length) return { rows: espnRows, source: 'espn' };

  const sherdog = await fetchSherdogSeasonHistory(playerName);
  if (sherdog.length) return { rows: sherdog, source: 'sherdog' };

  const career = await fetchMmaCoreCareerRow(athleteId);
  if (career) return { rows: [career], source: 'espn_mma_core' };

  return { rows: [], source: '' };
}

async function rowsFromSport(
  sportId: string,
  bundle: EspnAthleteBundle,
  position?: string,
  playerId?: string,
  playerName?: string,
): Promise<{ rows: PlayerSeasonRow[]; sources: string[] }> {
  if (sportId === 'fights' && playerId && playerName) {
    const fight = await rowsFromFights(playerId, playerName, bundle);
    return { rows: fight.rows, sources: fight.source ? [fight.source] : [] };
  }

  const payload = coerceEspnStatsPayload(bundle);
  const espnRows = filterMeaningfulSeasonRows(
    parseEspnSeasonHistory(sportId, payload, position),
  );
  if (espnRows.length) return { rows: espnRows, sources: ['espn'] };

  if (sportId === 'tennis') {
    const career = parseTennisCareerRow(bundle.bio);
    if (career) return { rows: [career], sources: ['espn'] };
  }

  return { rows: [], sources: [] };
}

/** Fetch fresh ESPN snapshot for an indexed player (no disk writes). */
export async function fetchPlayerSnapshot(entry: PlayerIndexEntry): Promise<PlayerSnapshot | null> {
  const sport = getSport(entry.sport);
  const espnId = entry.espnId ?? resolveLegendEspnId(entry.sport, entry.name);
  if (!espnId || !/^\d+$/.test(espnId)) return null;

  const bundle = await fetchEspnAthlete(sport, espnId);
  if (!bundle) return null;

  const meta = extractAthleteMeta(bundle);
  if (!meta) return null;

  const profile: PlayerProfileFields = {
    name: meta.name || entry.name,
    team: meta.team,
    position: meta.position,
    active: metaActive(bundle.bio),
    espnId,
  };

  let { rows, sources } = await rowsFromSport(
    entry.sport,
    bundle,
    profile.position,
    espnId,
    profile.name,
  );

  if (!rows.length && !sport.espnOnly) {
    const ref = await fetchSportsRefSeasonHistory({
      sportId: sport.id,
      playerId: espnId,
      playerName: profile.name,
      position: profile.position,
      slug: entry.slug,
    });
    if (ref.rows.length) {
      rows = ref.rows;
      sources = [ref.source];
    }
  }

  const recentGames = parseEspnGameLog(entry.sport, bundle.overview);
  const details = extractPlayerDetails(bundle);

  return {
    profile,
    details,
    seasonHistory: rows,
    recentGames,
    sources,
    bundle,
  };
}
