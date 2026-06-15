import type { PlayerSeasonRow } from '../../types/siyf.js';

type CsvMapping = Partial<Record<keyof PlayerSeasonRow, number>>;

export function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) {
      cols.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cols.push(current.trim());
  return cols;
}

function parseCsvRows(csv: string): string[][] {
  return csv
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('Season') && !line.startsWith('Rk'))
    .map(splitCsvLine);
}

function mapCsvRow(
  cols: string[],
  mapping: CsvMapping,
  seasonIdx = 0,
  teamIdx = 1,
): PlayerSeasonRow | null {
  const season = cols[seasonIdx]?.replace('*', '').trim();
  if (!season || season === 'Career' || !/^\d{4}/.test(season)) return null;
  const val = (idx?: number) =>
    idx !== undefined && idx >= 0 && cols[idx] !== undefined && cols[idx] !== ''
      ? cols[idx]
      : '-';
  return {
    season,
    team: teamIdx >= 0 ? cols[teamIdx]?.trim() : undefined,
    gp: val(mapping.gp),
    min: val(mapping.min),
    pts: val(mapping.pts),
    reb: val(mapping.reb),
    ast: val(mapping.ast),
    stl: val(mapping.stl),
    blk: val(mapping.blk),
    fgPct: val(mapping.fgPct),
    fg3Pct: val(mapping.fg3Pct),
    ftPct: val(mapping.ftPct),
    to: val(mapping.to),
  };
}

export function parseMappedCsv(
  csv: string,
  mapping: CsvMapping,
  seasonIdx = 0,
  teamIdx = 1,
  maxRows = 20,
): PlayerSeasonRow[] {
  const rows: PlayerSeasonRow[] = [];
  for (const cols of parseCsvRows(csv)) {
    if (cols.length < 8) continue;
    const row = mapCsvRow(cols, mapping, seasonIdx, teamIdx);
    if (row) rows.push(row);
  }
  return rows.slice(0, maxRows);
}

/** Column maps — mirrors `.engine/engine/sources/historicalSources.ts`. */
export const BBREF_MAP: CsvMapping = {
  gp: 5,
  min: 7,
  pts: 26,
  reb: 20,
  ast: 21,
  stl: 22,
  blk: 23,
  fgPct: 9,
  fg3Pct: 12,
  ftPct: 15,
  to: 24,
};

export const BREF_BATTING_MAP: CsvMapping = {
  gp: 4,
  min: 6,
  pts: 17,
  reb: 10,
  ast: 11,
  stl: 8,
  blk: 13,
  fgPct: 20,
  fg3Pct: 16,
  ftPct: 12,
  to: 14,
};

export const BREF_PITCHING_MAP: CsvMapping = {
  gp: 8,
  min: 13,
  pts: 6,
  reb: 4,
  ast: 12,
  stl: 7,
  blk: 16,
  fgPct: 5,
  fg3Pct: 18,
  ftPct: 10,
  to: 17,
};

export const PFR_PASSING_MAP: CsvMapping = {
  gp: 4,
  min: -1,
  pts: 9,
  reb: 10,
  ast: 11,
  stl: 6,
  blk: 7,
  fgPct: 8,
  fg3Pct: 12,
  ftPct: 5,
  to: 13,
};

export const PFR_RUSHING_MAP: CsvMapping = {
  gp: 4,
  min: -1,
  pts: 6,
  reb: 9,
  stl: 5,
  blk: 7,
  ast: 10,
  fgPct: 8,
  fg3Pct: -1,
  ftPct: -1,
  to: 11,
};

export const PFR_RECEIVING_MAP: CsvMapping = {
  gp: 4,
  min: -1,
  pts: 7,
  reb: 10,
  stl: 6,
  blk: 8,
  ast: 11,
  fgPct: 9,
  fg3Pct: -1,
  ftPct: -1,
  to: 12,
};

export const PFR_DEFENSE_MAP: CsvMapping = {
  gp: 4,
  min: -1,
  pts: 8,
  reb: 9,
  ast: 7,
  stl: 6,
  blk: 10,
  fgPct: 11,
  fg3Pct: -1,
  ftPct: -1,
  to: 12,
};

export const HREF_SKATER_MAP: CsvMapping = {
  gp: 5,
  min: 24,
  pts: 8,
  reb: -1,
  ast: 7,
  stl: -1,
  blk: 18,
  fgPct: -1,
  fg3Pct: -1,
  ftPct: -1,
  to: 9,
};

export const HREF_GOALIE_MAP: CsvMapping = {
  gp: 4,
  min: 29,
  pts: 6,
  reb: 4,
  ast: 5,
  stl: 7,
  blk: 8,
  fgPct: 9,
  fg3Pct: 10,
  ftPct: 11,
  to: 12,
};

export const FBREF_MAP: CsvMapping = {
  gp: 5,
  min: 8,
  pts: 11,
  reb: 12,
  ast: 13,
  stl: 14,
  blk: 15,
  fgPct: 16,
  fg3Pct: 17,
  ftPct: 18,
  to: 19,
};
