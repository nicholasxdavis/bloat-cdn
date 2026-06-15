import type { PlayerDetails } from '../types/siyf.js';
import type { PlayerGameLogRow, PlayerSeasonRow } from '../types/siyf.js';

export function rowsEqual(a: PlayerSeasonRow[], b: PlayerSeasonRow[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function gameLogsEqual(a: PlayerGameLogRow[] | undefined, b: PlayerGameLogRow[] | undefined): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

export interface PlayerProfileFields {
  name: string;
  team?: string;
  position?: string;
  active?: boolean;
  espnId?: string;
}

export function profileEqual(a: PlayerProfileFields, b: PlayerProfileFields): boolean {
  return (
    a.name === b.name
    && (a.team ?? '') === (b.team ?? '')
    && (a.position ?? '') === (b.position ?? '')
    && Boolean(a.active) === Boolean(b.active)
    && (a.espnId ?? '') === (b.espnId ?? '')
  );
}

function sortedAwards(awards?: string[]): string[] {
  return [...(awards ?? [])].map((a) => a.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function detailsEqual(a: PlayerDetails | undefined, b: PlayerDetails | undefined): boolean {
  const left = a ?? {};
  const right = b ?? {};
  return (
    (left.jersey ?? '') === (right.jersey ?? '')
    && (left.height ?? '') === (right.height ?? '')
    && (left.weight ?? '') === (right.weight ?? '')
    && (left.debutYear ?? 0) === (right.debutYear ?? 0)
    && (left.experience ?? '') === (right.experience ?? '')
    && (left.college ?? '') === (right.college ?? '')
    && (left.birthplace ?? '') === (right.birthplace ?? '')
    && (left.headshotSource ?? '') === (right.headshotSource ?? '')
    && JSON.stringify(sortedAwards(left.awards)) === JSON.stringify(sortedAwards(right.awards))
  );
}
