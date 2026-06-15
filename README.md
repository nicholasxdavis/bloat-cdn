# Bloat CDN

Historical sports data warehouse for [Sports In Your Face](https://github.com/Sports-in-your-face). Layer 1 static JSON on GitHub + [jsDelivr](https://www.jsdelivr.com/) — the engine reads career stats, teams, and headshots from CDN with **zero live ESPN calls** at runtime.

**Repo:** [nicholasxdavis/bloat-cdn](https://github.com/nicholasxdavis/bloat-cdn)

## Wire the engine

Set the CDN base to **`published/`** (not the repo root):

```bash
SIYF_CDN_URL=https://cdn.jsdelivr.net/gh/nicholasxdavis/bloat-cdn@main/published
VITE_SIYF_CDN_URL=https://cdn.jsdelivr.net/gh/nicholasxdavis/bloat-cdn@main/published
```

Local dev:

```bash
npm run serve   # static server on :8787 → published/
SIYF_CDN_URL=http://localhost:8787
```

The engine calls `fetchCdnJson('stats/bbref/jamesle01.json')`, `fetchCdnJson('teams/nba.json')`, and `resolveCdnAsset('media/headshots/nba/curryst01.png')`.

## CDN layout

```
https://cdn.jsdelivr.net/gh/nicholasxdavis/bloat-cdn@main/published
```

| Path | Engine use | Format |
|------|------------|--------|
| `stats/bbref/{slug}.json` | NBA / WNBA | `PlayerSeasonRow[]` |
| `stats/pfr/{slug}.json` | NFL | `PlayerSeasonRow[]` |
| `stats/bref/{slug}.json` | MLB | `PlayerSeasonRow[]` |
| `stats/href/{slug}.json` | NHL | `PlayerSeasonRow[]` |
| `stats/fbref/{slug}.json` | MLS / EPL | `PlayerSeasonRow[]` |
| `stats/espn-mma/{id}.json` | Fights | `PlayerSeasonRow[]` |
| `stats/espn-tennis/{id}.json` | Tennis | `PlayerSeasonRow[]` |
| `stats/espn-golf/{id}.json` | Golf | `PlayerSeasonRow[]` |
| `teams/{sport}.json` | Team registry | `ResolvedTeam[]` |
| `media/headshots/{sport}/{slug}.png` | Headshots | PNG |
| `media/logos/{sport}/{abbr}.png` | Logos | PNG |
| `meta/manifest.json` | Cache busting | `BloatManifest` |
| `meta/player-index.json` | Player lookup | Index |
| `meta/team-index.json` | Team lookup | Index |
| `meta/season-status.json` | Sync season gates | Per-sport status |
| `meta/team-aliases.json` | Abbr aliases | `Record<sport, Record<alias, abbr>>` |

`vault/` holds rich internal records (game logs, awards, sources). Sync jobs commit `vault/` + `published/` together.

## Automated sync (ingested players only)

Once a player is in `published/meta/player-index.json`, three jobs keep them current:

| Tier | GitHub Action | What updates | Scope |
|------|---------------|--------------|-------|
| **Nightly** | `sync-nightly.yml` — daily 08:00 UTC | Season history + recent games | In-season sports only; skips legends |
| **Weekly** | `sync-weekly.yml` — Sundays 10:00 UTC | Active, team, position, name | All ingested players |
| **Detail** | `sync-detail.yml` — 1st of odd months 11:00 UTC | Awards, vitals, college, headshots | Players not synced in 60+ days |

Season awareness (`ingest/src/lib/seasonAwareness.ts`) uses hard off-season months so NBA/NFL don't run in summer even when ESPN reports stale season types.

HTTP layer retries 429/5xx/timeouts (`BLOAT_FETCH_RETRIES`). Parsers use fuzzy label matching and extra ESPN payload shapes.

Only changed files are written. Reports: `ingest/logs/sync-*.json`.

```bash
npm install
npm run sync-nightly -- --dry-run   # preview season gates
npm run sync-weekly                 # profile refresh
npm run sync-detail                 # bi-monthly details (60-day window)
npm run sync                        # smart: Sun=weekly, detail days, else nightly
```

Manual ingest (one-time queue):

```bash
npm run scrape          # players from need.json
npm run scrape-teams    # teams from need-team.json
npm run manifest        # rebuild manifest
npm run stats           # warehouse counts
```

## Repo structure

```
bloat-cdn/
├── published/          # CDN root — jsDelivr serves this
├── vault/              # Rich player/team records
├── ingest/             # ETL + sync package
├── .github/workflows/  # sync-nightly, sync-weekly, sync-detail, ci
├── need.json           # Player ingest queue
└── need-team.json      # Team ingest queue
```

## Deploy checklist for devs

1. Clone [nicholasxdavis/bloat-cdn](https://github.com/nicholasxdavis/bloat-cdn).
2. Set `SIYF_CDN_URL` / `VITE_SIYF_CDN_URL` to the jsDelivr `published/` URL above.
3. Enable GitHub Actions on the repo (scheduled workflows need Actions enabled on the default branch).
4. After ingest, `npm run manifest` and commit — or let sync workflows auto-commit.

jsDelivr caches aggressively; bump `manifest.json` `syncedAt` or use `?v=` on meta fetches.
