/**
 * Sports-Reference slug rules — mirrors `.engine/engine/sources/historicalSources.ts`.
 */
export function sportsReferenceSlug(
  playerId: string | undefined,
  playerName: string,
  nfl = false,
): string | null {
  const id = playerId ?? '';
  if (/^Q\d+$/i.test(id) || id.startsWith('wikidata:')) {
    // External IDs — derive slug from display name only.
  } else if (id && /^[a-z]{5}\d{2}[a-z]?$/i.test(id)) {
    return nfl ? id.charAt(0).toUpperCase() + id.slice(1) : id.toLowerCase();
  }
  const parts = playerName.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const last5 = parts[parts.length - 1].slice(0, 5);
  const first2 = parts[0].slice(0, 2);
  if (nfl) {
    const lastPart = last5.charAt(0).toUpperCase() + last5.slice(1).toLowerCase();
    const firstPart = first2.charAt(0).toUpperCase() + first2.slice(1).toLowerCase();
    return `${lastPart}${firstPart}00`;
  }
  return `${last5.toLowerCase()}${first2.toLowerCase()}01`;
}

export function pfrSlugCandidates(playerId: string, playerName: string): string[] {
  if (/^[A-Za-z]{5}\d{2}[a-z]?$/i.test(playerId)) return [playerId];
  const parts = playerName.trim().split(/\s+/);
  if (parts.length < 2) return [];
  const last5 = parts[parts.length - 1].slice(0, 5);
  const first2 = parts[0].slice(0, 2);
  const base =
    last5.charAt(0).toUpperCase() +
    last5.slice(1).toLowerCase() +
    first2.charAt(0).toUpperCase() +
    first2.slice(1).toLowerCase();
  return ['00', '01', '02', '03'].map((n) => `${base}${n}`);
}

export function nameToVaultSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
