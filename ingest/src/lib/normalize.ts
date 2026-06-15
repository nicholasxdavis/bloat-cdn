/** Accent-insensitive name comparison for ESPN search matching. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameMatchScore(wanted: string, candidate: string): number {
  const a = normalizeName(wanted);
  const b = normalizeName(candidate);
  if (a === b) return 100;
  if (b.startsWith(a) || a.startsWith(b)) return 90;
  const stripSuffix = (parts: string[]) =>
    parts.filter((p) => !/^(ii|iii|iv|jr)$/i.test(p));
  const aParts = stripSuffix(a.split(' '));
  const bParts = stripSuffix(b.split(' '));
  const aLast = aParts[aParts.length - 1] ?? '';
  const bLast = bParts[bParts.length - 1] ?? '';
  if (aLast.length > 2 && aLast === bLast) {
    const aFirst = aParts[0] ?? '';
    const bFirst = bParts[0] ?? '';
    if (aFirst && bFirst && (aFirst[0] === bFirst[0] || aFirst.startsWith(bFirst) || bFirst.startsWith(aFirst))) {
      return 80;
    }
    return 70;
  }
  return 0;
}

export function pickBestNameMatch<T extends { name: string }>(wanted: string, hits: T[]): T | null {
  if (!hits.length) return null;
  let best = hits[0];
  let bestScore = nameMatchScore(wanted, best.name);
  for (const hit of hits.slice(1)) {
    const score = nameMatchScore(wanted, hit.name);
    if (score > bestScore) {
      best = hit;
      bestScore = score;
    }
  }
  return bestScore >= 50 ? best : null;
}

export function teamNameMatchScore(wanted: string, candidate: string): number {
  const base = nameMatchScore(wanted, candidate);
  if (base >= 75) return base;
  const a = normalizeName(wanted).split(' ');
  const b = normalizeName(candidate).split(' ');
  const aMascot = a[a.length - 1] ?? '';
  const bMascot = b[b.length - 1] ?? '';
  if (aMascot.length > 3 && aMascot === bMascot) return 80;
  return base;
}

export function pickBestTeamNameMatch<T extends { name: string }>(
  wanted: string,
  hits: T[],
): T | null {
  if (!hits.length) return null;
  let best = hits[0];
  let bestScore = teamNameMatchScore(wanted, best.name);
  for (const hit of hits.slice(1)) {
    const score = teamNameMatchScore(wanted, hit.name);
    if (score > bestScore) {
      best = hit;
      bestScore = score;
    }
  }
  return bestScore >= 55 ? best : null;
}
