#!/usr/bin/env node
/**
 * Backfill headshots for vault player JSON that still points at ESPN CDN URLs.
 *
 * Example:
 *   npm run backfill-headshots
 *   npm run backfill-headshots -- --sport nfl
 *   npm run backfill-headshots -- --force
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { downloadPlayerHeadshot } from '../lib/headshot.js';
import { repoPath } from '../lib/publish.js';
import type { PlayerVault } from '../types/siyf.js';

async function listVaultPlayers(sportFilter?: string): Promise<string[]> {
  const vaultRoot = repoPath('vault');
  const sports = sportFilter ? [sportFilter] : await readdir(vaultRoot);
  const files: string[] = [];

  for (const sport of sports) {
    const playersDir = path.join(vaultRoot, sport, 'players');
    try {
      const names = await readdir(playersDir);
      files.push(...names.map((f) => path.join(playersDir, f)));
    } catch {
      // sport dir may not exist
    }
  }
  return files.filter((f) => f.endsWith('.json'));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let sportFilter: string | undefined;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sport') sportFilter = argv[++i];
    if (argv[i] === '--force') force = true;
  }

  const files = await listVaultPlayers(sportFilter);
  console.log(`Scanning ${files.length} vault players…`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const raw = await readFile(filePath, 'utf8');
    const vault = JSON.parse(raw) as PlayerVault;
    const slug = vault.slug ?? vault.id;
    const espnId = vault.espnId;
    const alreadyLocal = vault.headshot?.startsWith('media/');

    if (!espnId && !vault.headshot?.startsWith('http')) {
      skipped++;
      continue;
    }
    if (alreadyLocal && !force) {
      skipped++;
      continue;
    }

    const sourceUrl =
      vault.headshotSource
      ?? (vault.headshot?.startsWith('http') ? vault.headshot : undefined);

    try {
      const result = await downloadPlayerHeadshot({
        sportId: vault.sport,
        slug,
        sourceUrl,
        espnId,
        force,
      });
      if (!result) {
        failed++;
        console.warn(`  ✗ ${vault.name}: no headshot`);
        continue;
      }

      const next: PlayerVault = {
        ...vault,
        headshot: result.cdnPath,
        headshotSource: result.sourceUrl,
      };
      await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      updated++;
      console.log(`  ✓ ${vault.name} → ${result.cdnPath}${result.downloaded ? '' : ' (cached)'}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ✗ ${vault.name}: ${msg}`);
    }
  }

  console.log(`Done: ${updated} updated, ${skipped} skipped, ${failed} failed`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
