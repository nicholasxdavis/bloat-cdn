#!/usr/bin/env node
/** Print bloat warehouse stats from indexes and on-disk published files. */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadPlayerIndex } from '../lib/playerIndex.js';
import { loadTeamIndex } from '../lib/teamIndex.js';
import { repoPath } from '../lib/publish.js';

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) count += await countFiles(full);
      else if (entry.isFile()) count += 1;
    }
  } catch {
    return 0;
  }
  return count;
}

async function countVaultPlayers(): Promise<number> {
  const vault = repoPath('vault');
  let count = 0;
  try {
    for (const sport of await readdir(vault, { withFileTypes: true })) {
      if (!sport.isDirectory()) continue;
      const playersDir = path.join(vault, sport.name, 'players');
      count += await countFiles(playersDir);
    }
  } catch {
    return 0;
  }
  return count;
}

async function main(): Promise<void> {
  const [players, teams] = await Promise.all([loadPlayerIndex(), loadTeamIndex()]);
  const published = repoPath('published');

  const [statsFiles, headshots, logos, vaultPlayers] = await Promise.all([
    countFiles(path.join(published, 'stats')),
    countFiles(path.join(published, 'media', 'headshots')),
    countFiles(path.join(published, 'media', 'logos')),
    countVaultPlayers(),
  ]);

  console.log('Bloat warehouse');
  console.log('─'.repeat(40));
  console.log(`Players indexed:  ${players.players.length}`);
  console.log(`Teams indexed:    ${teams.teams.length}`);
  console.log(`Stats JSON files: ${statsFiles}`);
  console.log(`Headshots:        ${headshots}`);
  console.log(`Team logos:       ${logos}`);
  console.log(`Vault players:    ${vaultPlayers}`);
  console.log(`Manifest:         published/meta/manifest.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
