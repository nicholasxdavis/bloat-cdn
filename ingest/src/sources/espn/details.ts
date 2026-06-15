import type { PlayerDetails } from '../../types/siyf.js';
import type { EspnAthleteBundle } from './fetch.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function placeString(value: unknown): string | undefined {
  const rec = asRecord(value);
  if (!rec) return str(value);
  const city = str(rec.city);
  const state = str(rec.state);
  const country = str(rec.country);
  const parts = [city, state, country].filter(Boolean);
  return parts.length ? parts.join(', ') : str(rec.displayName);
}

function collegeString(value: unknown): string | undefined {
  const rec = asRecord(value);
  if (!rec) return str(value);
  return str(rec.name) ?? str(rec.displayName);
}

function headshotUrl(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  const rec = asRecord(value);
  return str(rec?.href) ?? str(rec?.url);
}

function extractAwards(athlete: Record<string, unknown>): string[] {
  const awards: string[] = [];
  const seen = new Set<string>();

  const push = (label: string | undefined) => {
    const clean = label?.trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    awards.push(clean);
  };

  const rawAwards = athlete.awards;
  if (Array.isArray(rawAwards)) {
    for (const item of rawAwards) {
      const rec = asRecord(item);
      push(str(rec?.displayName) ?? str(rec?.name) ?? str(rec?.description) ?? str(item));
    }
  }

  const honors = athlete.honors ?? athlete.achievements;
  if (Array.isArray(honors)) {
    for (const item of honors) {
      const rec = asRecord(item);
      push(str(rec?.displayName) ?? str(rec?.name) ?? str(item));
    }
  }

  const overview = asRecord(athlete.overview);
  const overviewAwards = overview?.awards;
  if (Array.isArray(overviewAwards)) {
    for (const item of overviewAwards) {
      const rec = asRecord(item);
      push(str(rec?.displayName) ?? str(rec?.name) ?? str(item));
    }
  }

  return awards.sort((a, b) => a.localeCompare(b));
}

function athleteRoot(bundle: EspnAthleteBundle): Record<string, unknown> | null {
  const bioAthlete = asRecord(asRecord(bundle.bio)?.athlete);
  if (bioAthlete) return bioAthlete;
  const overviewAthlete = asRecord(asRecord(bundle.overview)?.athlete);
  if (overviewAthlete) return overviewAthlete;
  return asRecord(bundle.bio) ?? asRecord(bundle.overview);
}

/** Resilient extraction of slow-changing bio fields (awards, vitals, college). */
export function extractPlayerDetails(bundle: EspnAthleteBundle): PlayerDetails {
  const athlete = athleteRoot(bundle);
  if (!athlete) return {};

  const experience = asRecord(athlete.experience);
  const experienceYears = experience?.years ?? athlete.experienceYears;
  const debutYear = athlete.debutYear ?? athlete.debut;

  return {
    jersey: str(athlete.jersey) ?? str(athlete.uniformNumber),
    height: str(athlete.displayHeight) ?? str(athlete.height),
    weight: str(athlete.displayWeight) ?? str(athlete.weight),
    debutYear: typeof debutYear === 'number' ? debutYear : Number(debutYear) || undefined,
    experience: experienceYears != null ? String(experienceYears) : str(athlete.experience),
    college: collegeString(athlete.college),
    birthplace: placeString(athlete.birthPlace ?? athlete.birthplace),
    awards: extractAwards(athlete),
    headshotSource: headshotUrl(athlete.headshot),
  };
}
