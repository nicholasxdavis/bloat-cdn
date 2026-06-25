import type { SportConfig } from '../../types/siyf.js';

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPN_COMMON = 'https://site.api.espn.com/apis/common/v3/sports';

export const SPORTS: Record<string, SportConfig> = {
  nba: {
    id: 'nba',
    engineSport: 'BASKETBALL',
    cdnPrefix: 'bbref',
    espn: { siteBase: `${ESPN_SITE}/basketball/nba`, commonBase: `${ESPN_COMMON}/basketball/nba`, headshotFolder: 'nba' },
    sportsRef: { site: 'basketball-reference.com', statTypes: ['per_game'] },
  },
  wnba: {
    id: 'wnba',
    engineSport: 'BASKETBALL',
    cdnPrefix: 'bbref',
    espn: { siteBase: `${ESPN_SITE}/basketball/wnba`, commonBase: `${ESPN_COMMON}/basketball/wnba`, headshotFolder: 'wnba' },
    sportsRef: { site: 'basketball-reference.com', statTypes: ['per_game'] },
  },
  nfl: {
    id: 'nfl',
    engineSport: 'FOOTBALL',
    cdnPrefix: 'pfr',
    espn: { siteBase: `${ESPN_SITE}/football/nfl`, commonBase: `${ESPN_COMMON}/football/nfl`, headshotFolder: 'nfl' },
    sportsRef: { site: 'pro-football-reference.com', statTypes: ['passing', 'rushing', 'receiving', 'defense'] },
  },
  mlb: {
    id: 'mlb',
    engineSport: 'BASEBALL',
    cdnPrefix: 'bref',
    espn: { siteBase: `${ESPN_SITE}/baseball/mlb`, commonBase: `${ESPN_COMMON}/baseball/mlb`, headshotFolder: 'mlb' },
    sportsRef: { site: 'baseball-reference.com', statTypes: ['batting', 'pitching'] },
  },
  nhl: {
    id: 'nhl',
    engineSport: 'HOCKEY',
    cdnPrefix: 'href',
    espn: { siteBase: `${ESPN_SITE}/hockey/nhl`, commonBase: `${ESPN_COMMON}/hockey/nhl`, headshotFolder: 'nhl' },
    sportsRef: { site: 'hockey-reference.com', statTypes: ['skaters', 'goalie'] },
  },
  mls: {
    id: 'mls',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: {
      siteBase: `${ESPN_SITE}/soccer/usa.1`,
      commonBase: `${ESPN_COMMON}/soccer/usa.1`,
      headshotFolder: 'soccer',
      alternates: [{ siteBase: `${ESPN_SITE}/soccer/eng.1`, commonBase: `${ESPN_COMMON}/soccer/eng.1`, headshotFolder: 'soccer' }],
    },
  },
  epl: {
    id: 'epl',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/eng.1`, commonBase: `${ESPN_COMMON}/soccer/eng.1`, headshotFolder: 'soccer' },
  },
  laliga: {
    id: 'laliga',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/esp.1`, commonBase: `${ESPN_COMMON}/soccer/esp.1`, headshotFolder: 'soccer' },
  },
  bundesliga: {
    id: 'bundesliga',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/ger.1`, commonBase: `${ESPN_COMMON}/soccer/ger.1`, headshotFolder: 'soccer' },
  },
  seriea: {
    id: 'seriea',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/ita.1`, commonBase: `${ESPN_COMMON}/soccer/ita.1`, headshotFolder: 'soccer' },
  },
  ligue1: {
    id: 'ligue1',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/fra.1`, commonBase: `${ESPN_COMMON}/soccer/fra.1`, headshotFolder: 'soccer' },
  },
  ucl: {
    id: 'ucl',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/uefa.champions`, commonBase: `${ESPN_COMMON}/soccer/uefa.champions`, headshotFolder: 'soccer' },
  },
  europa: {
    id: 'europa',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/uefa.europa`, commonBase: `${ESPN_COMMON}/soccer/uefa.europa`, headshotFolder: 'soccer' },
  },
  ligamx: {
    id: 'ligamx',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/mex.1`, commonBase: `${ESPN_COMMON}/soccer/mex.1`, headshotFolder: 'soccer' },
  },
  brasileirao: {
    id: 'brasileirao',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/bra.1`, commonBase: `${ESPN_COMMON}/soccer/bra.1`, headshotFolder: 'soccer' },
  },
  eredivisie: {
    id: 'eredivisie',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/ned.1`, commonBase: `${ESPN_COMMON}/soccer/ned.1`, headshotFolder: 'soccer' },
  },
  championship: {
    id: 'championship',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/eng.2`, commonBase: `${ESPN_COMMON}/soccer/eng.2`, headshotFolder: 'soccer' },
  },
  primeira: {
    id: 'primeira',
    engineSport: 'SOCCER',
    cdnPrefix: 'fbref',
    espn: { siteBase: `${ESPN_SITE}/soccer/por.1`, commonBase: `${ESPN_COMMON}/soccer/por.1`, headshotFolder: 'soccer' },
  },
  fights: {
    id: 'fights',
    engineSport: 'FIGHTS',
    cdnPrefix: 'espn-mma',
    espnOnly: true,
    espn: {
      siteBase: `${ESPN_SITE}/mma/ufc`,
      commonBase: `${ESPN_COMMON}/mma`,
      athleteBase: `${ESPN_COMMON}/mma/athletes`,
      headshotFolder: 'mma',
    },
  },
  tennis: {
    id: 'tennis',
    engineSport: 'TENNIS',
    cdnPrefix: 'espn-tennis',
    espnOnly: true,
    espn: {
      siteBase: `${ESPN_SITE}/tennis/atp`,
      commonBase: `${ESPN_COMMON}/tennis/atp`,
      headshotFolder: 'tennis',
      alternates: [{ siteBase: `${ESPN_SITE}/tennis/wta`, commonBase: `${ESPN_COMMON}/tennis/wta`, headshotFolder: 'tennis' }],
    },
  },
  golf: {
    id: 'golf',
    engineSport: 'GOLF',
    cdnPrefix: 'espn-golf',
    espnOnly: true,
    espn: {
      siteBase: `${ESPN_SITE}/golf/pga`,
      commonBase: `${ESPN_COMMON}/golf/pga`,
      headshotFolder: 'golf',
      alternates: [{ siteBase: `${ESPN_SITE}/golf/lpga`, commonBase: `${ESPN_COMMON}/golf/lpga`, headshotFolder: 'golf' }],
    },
  },
};

export function getSport(id: string): SportConfig {
  const sport = SPORTS[id.toLowerCase()];
  if (!sport) {
    throw new Error(`Unknown sport "${id}". Supported: ${Object.keys(SPORTS).join(', ')}`);
  }
  return sport;
}

export function allEspnEndpointSets(sport: SportConfig): SportConfig['espn'][] {
  return [sport.espn, ...(sport.espn.alternates ?? [])];
}
