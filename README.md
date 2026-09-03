# Peppermint Robotics Fleet Management Dashboard

Frontend submission for the Peppermint Robotics SDE-1 hiring challenge ("Fleet Management
Dashboard," Assignment 1). An operator dashboard for an 8-robot fleet: a live site map,
recorded-log replay, a genuinely independent synthetic live feed, a fleet-level trend chart,
and robot search/attention tooling — all driven by one shared fleet state.

## Project Summary

This is the **frontend assignment**. It visualizes and operates a simulated warehouse robot
fleet in two interchangeable modes:

- **Recorded replay** of the supplied `events.jsonl` log, at faster-than-real-time speeds.
- **Synthetic live simulation** — new events generated independently in the browser, never
  read from the recorded log.

Both modes drive the exact same dashboard (map, fleet overview, trend chart, search) through
one shared event-processing pipeline and one reducer.

## Key Features

- Warehouse layout (`layout.png`) with all 8 robots rendered at their live positions.
- Recorded event replay, preserving original event order and timestamp grouping.
- Playback speed control (1x/2x/5x/10x), Play/Pause/Reset, and completion handling.
- Synthetic live simulation with continuous movement, gradual battery change, and status
  transitions — structurally independent of `events.jsonl` (no import path to it exists).
- Mutually exclusive Replay/Live modes with no duplicate or leaked timers.
- Fleet Overview metrics (total, working, needs attention, average battery).
- Fleet Working % trend chart, built from real recorded/generated history — not static data.
- Robot search by ID (case-insensitive, partial match) and a "Needs attention" filter.
- Robot selection from either the map or search results, with a live-updating details panel.
- Responsive layout (desktop down to mobile widths).

## Tech Stack

From `package.json`:

- **React 19** + **TypeScript** — UI and domain typing.
- **Vite 8** — dev server and production build.
- **Vitest 4** + **React Testing Library** + **jsdom** — testing.
- Plain CSS (component-scoped files). No UI/animation/charting library, no state-management
  library — see `SYSTEM_DESIGN.md` and `ANSWERS.md` for why.

## Project Structure

```
public/data/                 robots.json / events.jsonl / layout.png, fetched by the app
                              at runtime (see src/data/)
src/
  domain/                    Pure business logic: models, classification, event
                             validation/normalization/application, fleet metrics & history
  data/                      Loads robots.json / events.jsonl / layout.png (the only
                             place these files are read)
  replay/                    Recorded-log playback engine (timing/scheduling only)
  live/                      Synthetic live generator (simulation + scheduling; no
                             dependency on data/ or replay/)
  hooks/                     useReplay / useLiveFeed — React bindings over the two engines
  state/                     fleetReducer.ts (the only place FleetState is produced) and
                             FleetContext.tsx (React wiring)
  components/                Dashboard, Map, RobotDetails, Search, Trend — presentation only
  tests/                     Vitest test suite (99 tests)
```

## Running Locally

```bash
npm install
npm run dev
```

Opens the dev server (default `http://localhost:5173`).

```bash
npm run test
```

Runs the full Vitest suite once.

```bash
npm run build
```

Type-checks (`tsc -b`) and produces a static production build in `dist/`.

## Data

- **`robots.json`** — the fixed 8-robot roster (ID, type, starting position). Loaded once via
  `src/data/robots.ts` into static `RobotDefinition`s; never mutated.
- **`events.jsonl`** — the 15-minute recorded log. Loaded via `src/data/events.ts`, grouped by
  timestamp (`src/replay/timestampGroups.ts`), and replayed through `src/replay/replayEngine.ts`.
- **`layout.png`** — the site image (900×560px, 1px = 1 unit). Rendered as the map background
  in `src/components/Map/FleetMap.tsx`; robot positions are mapped onto it with a direct,
  scale-free percentage conversion (`src/domain/mapCoordinates.ts`).

## Recorded Replay

- `events.jsonl` is verified pre-sorted and tick-aligned (every 5 recorded seconds, 8 events
  per tick) — the engine preserves this order exactly; nothing re-sorts it.
- `src/replay/timestampGroups.ts` groups same-timestamp events into one logical tick, applied
  atomically so all 8 robots update together for a given moment.
- `src/replay/replayEngine.ts` schedules each tick from the recorded `t` delta ÷ the selected
  speed multiplier (1x/2x/5x/10x) — never from a fixed interval or wall-clock time.
- Play/Pause/Reset are implemented as a small state machine in the same file; Reset restores
  the exact starting fleet state (via `src/domain/createInitialFleetState.ts`) and clears the
  trend history.

## Synthetic Live Mode

- `src/live/liveGenerator.ts` and `src/live/liveSimulation.ts` generate new events entirely
  independently — neither file imports `src/data/events.ts` or anything under `src/replay/`.
- Each tick, working robots move incrementally toward a randomly chosen target
  (`moveToward`/`pickRandomTarget`), battery drains or charges gradually and stays within
  [0, 100], and status transitions follow a small fixed-probability table
  (`src/live/liveConstants.ts`) — most ticks, nothing changes.
- Generated events pass through the same `validateEvent` → `normalizeEvent` → `applyEvent`
  pipeline as replay (`src/domain/processIncomingEvent.ts`), so there is no separate
  fleet-mutation path for live data.
- Live mode has its own synthetic clock (`state.live.tick`), reset to 0 every time the app
  switches into Live mode — it is never derived from Replay's recorded timestamp.
- Rate: a new event is generated for the whole fleet roughly every 4 seconds of wall-clock
  time (`LIVE_TICK_INTERVAL_MS` in `src/live/liveConstants.ts`), each tick advancing the
  synthetic clock by 5 seconds (`LIVE_TICK_STEP_SECONDS`) — close to the recorded log's own
  5-second reporting interval, without being tied to it.

## Fleet Trend

- Metric: **Fleet Working %** — the share of robots currently `active` or `on_mission`
  (`src/domain/classification.ts`'s `isWorking`), computed by `deriveFleetHistoryPoint` in
  `src/domain/fleetMetrics.ts`.
- One history point is recorded per tick, directly inside the reducer's `ADVANCE_REPLAY_TICK`
  / `ADVANCE_LIVE_TICK` cases (`src/state/fleetReducer.ts`) — the only place a point is ever
  appended, so a UI-only render can't produce a duplicate one.
- Replay plots against a fixed 0–900s axis (the known recorded window); Live plots against a
  dynamic axis (it has no fixed endpoint). History clears whenever the mode actually changes,
  so recorded and synthetic timelines are never mixed in one chart.
- History is capped at `MAX_HISTORY_POINTS` (300, in `src/domain/constants.ts`) — comfortably
  above replay's fixed 181 ticks, bounding an indefinite live session to roughly 20 minutes
  before the oldest points drop.

## Testing

`npm run test` runs the full suite — **99 tests across 13 files**, verified passing at the
time of writing. Coverage focuses on business logic rather than markup:

- Event validation/normalization/application (`applyEvent`, `validateEvent`,
  `processIncomingEvent`).
- Replay grouping and timing (`timestampGroups`, `replayEngine`, including fake-timer tests
  for play/pause/resume/completion/reset).
- Live simulation and scheduling (`liveSimulation`, `liveGenerator`).
- Fleet metrics and trend-history derivation (`fleetMetrics`, `fleetReducer`).
- Search/attention filtering (`searchFiltering`).
- Trend chart coordinate math (`trendChartMath`).

## Known Tradeoffs / What's Next

- **No backend** — the live feed and history are entirely client-side; a production system
  would ingest real robot telemetry through a proper backend (see `SYSTEM_DESIGN.md`).
- **No persisted history** — the trend chart only covers the current browser session; nothing
  survives a page reload.
- **No robot-level historical detail view** — only fleet-level trend is shown, not a per-robot
  timeline (the backend assignment's optional stretch goal, not part of this track).
- **No authentication/multi-user support** — single-operator, single-session dashboard.
- **Live simulation is a small, hand-tuned rule set**, not a physically modeled fleet — plausible
  for a demo, not a behavioral simulator.

## AI Tooling and Delegation

This project was built with Claude Code (Anthropic) as an active collaborator, used
throughout implementation rather than for a single one-shot generation:

- Implementation proceeded in explicit, incremental phases (data pipeline → domain
  models → dashboard/map → replay → live simulation → search → trend chart → an
  integration/audit pass), each reviewed and tested before moving to the next.
- Architecture and challenge-specific judgment calls (status classification, the low-battery
  threshold, live-feed independence from the recorded log, replay-vs-live timeline handling)
  were made against the actual supplied data files and the challenge brief, not generic
  defaults — verified directly against `robots.json`/`events.jsonl`/`layout.png` where the
  brief left something open.
- Code was generated incrementally per phase and manually inspected each time, not accepted
  wholesale.
- Tests, `tsc` type-checking, and production builds were run after each phase. Application
  behavior (replay, live mode, mode switching, search, the trend chart, responsive layout)
  was verified in a real browser, including a dedicated integration-audit pass that found and
  fixed two genuine bugs (a React key collision on Reset→Play, and the live clock incorrectly
  inheriting replay's timestamp) before this documentation was written.
- I did not write this code by hand line-by-line, and I did not accept AI output without
  reading and testing it — every phase included verification, not just generation.
