import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchBytes } from './http.js';
import { repoPath } from './publish.js';

/** ESPN CDN folder segment per bloat sport id. */
const ESPN_HEADSHOT_FOLDER: Record<string, string> = {
  nba: 'nba',
  wnba: 'wnba',
  nfl: 'nfl',
  mlb: 'mlb',
  nhl: 'nhl',
  mls: 'soccer',
  epl: 'soccer',
  fights: 'mma',
  tennis: 'tennis',
  golf: 'golf',
};

const EXT_FROM_TYPE: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function espnHeadshotUrl(sportId: string, espnId: string, folder?: string): string {
  const seg = folder ?? ESPN_HEADSHOT_FOLDER[sportId] ?? sportId;
  return `https://a.espncdn.com/i/headshots/${seg}/players/full/${espnId}.png`;
}

/** Relative path for jsDelivr — matches `resolveCdnAsset()` in the engine. */
export function cdnHeadshotPath(sportId: string, slug: string, ext = '.png'): string {
  return `media/headshots/${sportId}/${slug.toLowerCase()}${ext}`;
}

export function publishedHeadshotPath(sportId: string, slug: string, ext = '.png'): string {
  return repoPath('published', cdnHeadshotPath(sportId, slug, ext));
}

function extFromUrl(url: string): string | null {
  const match = url.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return ext === 'jpeg' ? '.jpg' : `.${ext}`;
}

function extFromContentType(contentType: string | null): string {
  if (!contentType) return '.png';
  const base = contentType.split(';')[0].trim().toLowerCase();
  return EXT_FROM_TYPE[base] ?? '.png';
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface DownloadHeadshotInput {
  sportId: string;
  slug: string;
  sourceUrl?: string | null;
  espnId?: string;
  headshotFolder?: string;
  force?: boolean;
}

export interface DownloadHeadshotResult {
  cdnPath: string;
  filePath: string;
  downloaded: boolean;
  sourceUrl: string;
}

/**
 * Download a player headshot once during ingest and store under `published/media/headshots/`.
 * Vault JSON should reference the returned `cdnPath`, not the ESPN CDN URL.
 */
export async function downloadPlayerHeadshot(
  input: DownloadHeadshotInput,
): Promise<DownloadHeadshotResult | null> {
  const sourceUrl =
    input.sourceUrl?.trim()
    || (input.espnId ? espnHeadshotUrl(input.sportId, input.espnId, input.headshotFolder) : null);
  if (!sourceUrl) return null;

  const ext = extFromUrl(sourceUrl) ?? '.png';
  const filePath = publishedHeadshotPath(input.sportId, input.slug, ext);
  const cdnPath = cdnHeadshotPath(input.sportId, input.slug, ext);

  if (!input.force && (await fileExists(filePath))) {
    return { cdnPath, filePath, downloaded: false, sourceUrl };
  }

  const { bytes, contentType } = await fetchBytes(sourceUrl);
  if (bytes.length < 128) return null;

  const resolvedExt = extFromUrl(sourceUrl) ?? extFromContentType(contentType);
  const outPath =
    resolvedExt === ext ? filePath : publishedHeadshotPath(input.sportId, input.slug, resolvedExt);
  const outCdn =
    resolvedExt === ext ? cdnPath : cdnHeadshotPath(input.sportId, input.slug, resolvedExt);

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);

  return {
    cdnPath: outCdn,
    filePath: outPath,
    downloaded: true,
    sourceUrl,
  };
}
