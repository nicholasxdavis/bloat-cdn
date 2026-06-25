import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchBytes } from './http.js';
import { repoPath } from './publish.js';

const LOGO_SPORT_FOLDER: Record<string, string> = {
  nba: 'nba',
  wnba: 'wnba',
  nfl: 'nfl',
  mlb: 'mlb',
  nhl: 'nhl',
  mls: 'mls',
  epl: 'epl',
  laliga: 'laliga',
  bundesliga: 'bundesliga',
  seriea: 'seriea',
  ligue1: 'ligue1',
  ucl: 'ucl',
  europa: 'europa',
  ligamx: 'ligamx',
  brasileirao: 'brasileirao',
  eredivisie: 'eredivisie',
  championship: 'championship',
  primeira: 'primeira',
};

export function cdnTeamLogoPath(sportId: string, abbr: string, ext = '.png'): string {
  const folder = LOGO_SPORT_FOLDER[sportId] ?? sportId;
  return `media/logos/${folder}/${abbr.toLowerCase()}${ext}`;
}

export function publishedTeamLogoPath(sportId: string, abbr: string, ext = '.png'): string {
  return repoPath('published', cdnTeamLogoPath(sportId, abbr, ext));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface DownloadTeamLogoResult {
  cdnPath: string;
  filePath: string;
  downloaded: boolean;
  sourceUrl: string;
}

export async function downloadTeamLogo(
  sportId: string,
  abbr: string,
  sourceUrl: string,
  force = false,
): Promise<DownloadTeamLogoResult | null> {
  if (!sourceUrl?.startsWith('http')) return null;

  const ext = sourceUrl.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i)?.[1]
    ? `.${sourceUrl.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i)![1].toLowerCase().replace('jpeg', 'jpg')}`
    : '.png';

  const filePath = publishedTeamLogoPath(sportId, abbr, ext);
  const cdnPath = cdnTeamLogoPath(sportId, abbr, ext);

  if (!force && (await fileExists(filePath))) {
    return { cdnPath, filePath, downloaded: false, sourceUrl };
  }

  const { bytes } = await fetchBytes(sourceUrl);
  if (bytes.length < 64) return null;

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);

  return { cdnPath, filePath, downloaded: true, sourceUrl };
}
