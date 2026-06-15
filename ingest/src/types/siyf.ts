/** SIYF engine contract — keep in sync with `.engine/types.ts`. */

export interface StatItem {
  label: string;
  value: string | number;
}

export interface PlayerSeasonRow {
  season: string;
  team?: string;
  gp: string;
  min: string;
  pts: string;
  reb: string;
  ast: string;
  stl: string;
  blk: string;
  fgPct: string;
  fg3Pct: string;
  ftPct: string;
  to: string;
}

export interface PlayerGameLogRow {
  date: string;
  matchup: string;
  result: string;
  min: string;
  pts: string;
  reb: string;
  ast: string;
  stl: string;
  blk: string;
}

/** Slow-changing bio / honors — refreshed on bi-monthly detail sync. */
export interface PlayerDetails {
  jersey?: string;
  height?: string;
  weight?: string;
  debutYear?: number;
  experience?: string;
  college?: string;
  birthplace?: string;
  awards?: string[];
  headshotSource?: string;
}

export interface PlayerVault {
  id: string;
  espnId?: string;
  slug?: string;
  name: string;
  sport: string;
  position?: string;
  team?: string;
  /** jsDelivr-relative path, e.g. `media/headshots/nba/jamesle01.png` */
  headshot?: string;
  /** Original remote URL used during ingest (audit / re-fetch). */
  headshotSource?: string;
  legend?: boolean;
  seasonHistory: PlayerSeasonRow[];
  recentGames?: PlayerGameLogRow[];
  sources: string[];
  ingestedAt: string;
  /** ESPN active flag when available. */
  active?: boolean;
  profileSyncedAt?: string;
  statsSyncedAt?: string;
  /** Awards, vitals, college — bi-monthly detail sync. */
  details?: PlayerDetails;
  detailSyncedAt?: string;
}

/**
 * CDN stats prefix — team sports match `historicalSources.ts`.
 * Individual sports use espn-* until engine CDN hooks land.
 */
export type CdnStatsPrefix =
  | 'bbref'
  | 'pfr'
  | 'bref'
  | 'href'
  | 'fbref'
  | 'espn-mma'
  | 'espn-tennis'
  | 'espn-golf';

export interface EspnEndpoints {
  siteBase: string;
  commonBase: string;
  /** When set, athlete URLs are `${athleteBase}/${id}` (MMA). */
  athleteBase?: string;
  alternates?: EspnEndpoints[];
  headshotFolder?: string;
}

export interface SportConfig {
  id: string;
  engineSport: string;
  cdnPrefix: CdnStatsPrefix;
  espn: EspnEndpoints;
  /** Slug is ESPN numeric id (tennis, golf, MMA). */
  espnOnly?: boolean;
  sportsRef?: {
    site: string;
    statTypes: string[];
  };
}
