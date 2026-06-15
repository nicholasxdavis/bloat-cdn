/** Engine contract — keep in sync with `.engine/engine/core/types.ts` ResolvedTeam */

export interface ResolvedTeam {
  id: string;
  espnId?: string;
  bdlId?: number;
  name: string;
  abbr: string;
  city: string;
  logo: string;
  color?: string;
  alternateColor?: string;
  conference?: string;
  division?: string;
  note?: string;
}

export interface TeamRecordSplit {
  label: string;
  summary: string;
}

export interface TeamVault {
  id: string;
  espnId: string;
  abbr: string;
  name: string;
  city: string;
  sport: string;
  logo?: string;
  logoSource?: string;
  color?: string;
  alternateColor?: string;
  conference?: string;
  division?: string;
  standingSummary?: string;
  record?: TeamRecordSplit[];
  venue?: string;
  roster?: Array<{ id: string; name: string; position?: string }>;
  tier?: string;
  top10?: boolean;
  sources: string[];
  ingestedAt: string;
}

export interface TeamIndexEntry {
  sport: string;
  name: string;
  abbr: string;
  espnId: string;
  tier?: string;
  top10: boolean;
  logo?: string;
  registryPath: string;
  vaultPath?: string;
  ingestedAt: string;
}

export interface TeamIndex {
  version: number;
  syncedAt: string;
  teams: TeamIndexEntry[];
}
