# Bloat CDN

Historical sports data warehouse for [Sports In Your Face](https://github.com/Sports-in-your-face).

**Repo:** [nicholasxdavis/bloat-cdn](https://github.com/nicholasxdavis/bloat-cdn)



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
