import { detailsEqual, gameLogsEqual, profileEqual, rowsEqual } from '../lib/diff.js';
import type { PlayerIndexEntry } from '../lib/playerIndex.js';
import { upsertPlayerIndex } from '../lib/playerIndex.js';
import { downloadPlayerHeadshot } from '../lib/headshot.js';
import {
  loadPlayerVault,
  loadPublishedStats,
  patchPlayerDetail,
  patchPlayerProfile,
  patchPlayerStats,
} from '../lib/publish.js';
import { getSport } from '../sources/espn/config.js';
import { fetchPlayerSnapshot } from './playerData.js';

export interface SyncPlayerResult {
  name: string;
  sport: string;
  status: 'updated' | 'unchanged' | 'skipped' | 'failed';
  detail?: string;
  changes?: string[];
}

export async function syncPlayerProfile(entry: PlayerIndexEntry): Promise<SyncPlayerResult> {
  const base = { name: entry.name, sport: entry.sport };

  try {
    const vault = await loadPlayerVault(entry.sport, entry.name);
    if (!vault) {
      return { ...base, status: 'skipped', detail: 'no vault record' };
    }

    const snapshot = await fetchPlayerSnapshot(entry);
    if (!snapshot) {
      return { ...base, status: 'failed', detail: 'could not fetch ESPN snapshot' };
    }

    const prev = {
      name: vault.name,
      team: vault.team,
      position: vault.position,
      active: vault.active,
      espnId: vault.espnId,
    };

    if (profileEqual(prev, snapshot.profile)) {
      return { ...base, status: 'unchanged' };
    }

    const changes: string[] = [];
    if (prev.team !== snapshot.profile.team) {
      changes.push(`team: ${prev.team ?? '—'} → ${snapshot.profile.team ?? '—'}`);
    }
    if (prev.position !== snapshot.profile.position) {
      changes.push(`position: ${prev.position ?? '—'} → ${snapshot.profile.position ?? '—'}`);
    }
    if (Boolean(prev.active) !== Boolean(snapshot.profile.active)) {
      changes.push(`active: ${prev.active ?? '—'} → ${snapshot.profile.active ?? '—'}`);
    }
    if (prev.name !== snapshot.profile.name) {
      changes.push(`name: ${prev.name} → ${snapshot.profile.name}`);
    }

    await patchPlayerProfile(entry.sport, vault, snapshot.profile);

    const now = new Date().toISOString();
    await upsertPlayerIndex({
      ...entry,
      name: snapshot.profile.name,
      team: snapshot.profile.team,
      position: snapshot.profile.position,
      active: snapshot.profile.active,
      espnId: snapshot.profile.espnId ?? entry.espnId,
      profileSyncedAt: now,
    });

    return { ...base, name: snapshot.profile.name, status: 'updated', changes };
  } catch (err) {
    return {
      ...base,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function syncPlayerStats(entry: PlayerIndexEntry): Promise<SyncPlayerResult> {
  const base = { name: entry.name, sport: entry.sport };

  if (entry.legend) {
    return { ...base, status: 'skipped', detail: 'legend — stats frozen' };
  }

  try {
    const sport = getSport(entry.sport);
    const vault = await loadPlayerVault(entry.sport, entry.name);
    if (!vault) {
      return { ...base, status: 'skipped', detail: 'no vault record' };
    }

    const snapshot = await fetchPlayerSnapshot(entry);
    if (!snapshot) {
      return { ...base, status: 'failed', detail: 'could not fetch ESPN snapshot' };
    }

    if (!snapshot.seasonHistory.length) {
      return { ...base, status: 'skipped', detail: 'no season history from source' };
    }

    const published = await loadPublishedStats(sport.cdnPrefix, entry.slug);
    const statsSame = published ? rowsEqual(published, snapshot.seasonHistory) : false;
    const gamesSame = gameLogsEqual(vault.recentGames, snapshot.recentGames);

    if (statsSame && gamesSame) {
      return { ...base, status: 'unchanged' };
    }

    const changes: string[] = [];
    if (!statsSame) {
      const prevRows = published?.length ?? vault.seasonHistory.length;
      changes.push(`seasonHistory: ${prevRows} → ${snapshot.seasonHistory.length} rows`);
    }
    if (!gamesSame) {
      changes.push(`recentGames: ${vault.recentGames?.length ?? 0} → ${snapshot.recentGames.length} games`);
    }

    await patchPlayerStats(
      sport.cdnPrefix,
      entry.slug,
      entry.sport,
      vault,
      snapshot.seasonHistory,
      snapshot.recentGames,
    );

    const now = new Date().toISOString();
    await upsertPlayerIndex({
      ...entry,
      rowCount: snapshot.seasonHistory.length,
      sources: snapshot.sources.length ? snapshot.sources : entry.sources,
      statsSyncedAt: now,
    });

    return { ...base, status: 'updated', changes };
  } catch (err) {
    return {
      ...base,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

const DETAIL_STALE_MS = 60 * 24 * 60 * 60 * 1000;

export function isDetailSyncDue(entry: PlayerIndexEntry, at = new Date()): boolean {
  if (!entry.detailSyncedAt) return true;
  const last = Date.parse(entry.detailSyncedAt);
  if (Number.isNaN(last)) return true;
  return at.getTime() - last >= DETAIL_STALE_MS;
}

export async function syncPlayerDetail(entry: PlayerIndexEntry): Promise<SyncPlayerResult> {
  const base = { name: entry.name, sport: entry.sport };

  try {
    const sport = getSport(entry.sport);
    const vault = await loadPlayerVault(entry.sport, entry.name);
    if (!vault) {
      return { ...base, status: 'skipped', detail: 'no vault record' };
    }

    const snapshot = await fetchPlayerSnapshot(entry);
    if (!snapshot) {
      return { ...base, status: 'failed', detail: 'could not fetch ESPN snapshot' };
    }

    const prevDetails = vault.details ?? {};
    const nextDetails = snapshot.details;
    const headshotSourceChanged =
      Boolean(nextDetails.headshotSource)
      && nextDetails.headshotSource !== (vault.headshotSource ?? prevDetails.headshotSource);

    let nextHeadshot = vault.headshot;
    let headshotDownloaded = false;

    if (headshotSourceChanged || (!vault.headshot && nextDetails.headshotSource)) {
      const dl = await downloadPlayerHeadshot({
        sportId: entry.sport,
        slug: entry.slug,
        sourceUrl: nextDetails.headshotSource,
        espnId: snapshot.profile.espnId ?? entry.espnId,
        headshotFolder: sport.espn.headshotFolder,
        force: headshotSourceChanged,
      });
      if (dl) {
        nextHeadshot = dl.cdnPath;
        headshotDownloaded = dl.downloaded;
      }
    }

    const detailsChanged = !detailsEqual(prevDetails, nextDetails);
    const headshotChanged = nextHeadshot !== vault.headshot;

    if (!detailsChanged && !headshotChanged) {
      const now = new Date().toISOString();
      await upsertPlayerIndex({ ...entry, detailSyncedAt: now });
      return { ...base, status: 'unchanged' };
    }

    const changes: string[] = [];
    if (detailsChanged) {
      const prevAwards = prevDetails.awards?.length ?? 0;
      const nextAwards = nextDetails.awards?.length ?? 0;
      if (prevAwards !== nextAwards) {
        changes.push(`awards: ${prevAwards} → ${nextAwards}`);
      } else {
        changes.push('bio details');
      }
    }
    if (headshotChanged) {
      changes.push(headshotDownloaded ? 'headshot re-downloaded' : 'headshot path');
    }

    const mergedSources = [...new Set([...vault.sources, ...snapshot.sources])];

    await patchPlayerDetail(entry.sport, vault, {
      details: nextDetails,
      headshot: nextHeadshot,
      headshotSource: nextDetails.headshotSource ?? vault.headshotSource,
      sources: mergedSources,
    });

    const now = new Date().toISOString();
    await upsertPlayerIndex({
      ...entry,
      headshot: nextHeadshot ?? entry.headshot,
      detailSyncedAt: now,
    });

    return { ...base, status: 'updated', changes };
  } catch (err) {
    return {
      ...base,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
