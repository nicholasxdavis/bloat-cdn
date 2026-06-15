import { normalizeName } from './normalize.js';

/** Verified ESPN athlete IDs for players missing from global search. */
export const LEGEND_ESPN_IDS: Record<string, Record<string, string>> = {
  nba: {
    'michael jordan': '1035',
    'kobe bryant': '110',
    'shaquille oneal': '614',
    'dirk nowitzki': '609',
    'kevin garnett': '261',
    'john stockton': '812',
    'dwyane wade': '1987',
  },
  nfl: {
    'tom brady': '2330',
    'peyton manning': '1428',
  },
  mlb: {
    'mike trout': '30836',
  },
  fights: {
    'conor mcgregor': '3022677',
    'jon jones': '2335639',
  },
  tennis: {
    'roger federer': '425',
    'serena williams': '394',
  },
  mls: {
    'cristiano ronaldo': '22774',
    'kylian mbappe': '231388',
  },
};

function legendKey(name: string): string {
  return normalizeName(name).replace(/['.]/g, '');
}

export function resolveLegendEspnId(sportId: string, name: string): string | undefined {
  return LEGEND_ESPN_IDS[sportId]?.[legendKey(name)];
}
