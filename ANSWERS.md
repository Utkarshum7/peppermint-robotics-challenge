# ANSWERS.md

Frontend assignment — written answers, referencing the actual implementation in this
repository.

---

## 1. What holds the fleet's state as data arrives, and why that shape, given that both the replay and your live feed need to drive the same views?

`FleetState.robots`, a `Record<string, RobotRuntimeState>` keyed by `robotId`, defined in
`src/domain/models.ts` and owned exclusively by `src/state/fleetReducer.ts`. It is the single
canonical fleet-runtime source of truth — the map, Fleet Overview, search results, robot
details, and the trend chart all read directly from it or from small selector functions built
on top of it (`src/domain/fleetMetrics.ts`); none of them keep a separate copy.

That shape exists specifically because of the "both replay and live drive the same views"
requirement in the question. Neither `src/replay/replayEngine.ts` nor
`src/live/liveGenerator.ts` is allowed to touch `FleetState` directly — each only produces
raw, source-agnostic events and hands them to its React binding (`src/hooks/useReplay.ts` /
`src/hooks/useLiveFeed.ts`), which pushes every event through the identical pipeline:
`validateEvent` → `normalizeEvent` (exposed together as `toFleetEvent` in
`src/domain/processIncomingEvent.ts`) → a dispatched `APPLY_EVENT` action → the pure
`applyEvent` function in `src/domain/applyEvent.ts`, which replaces exactly one robot's entry
immutably. By the time an event reaches the reducer, there is no field or flag anywhere
recording which source produced it — the reducer's `APPLY_EVENT` case is a single line
(`applyEvent(state.robots, action.event)`), the same one every time. This is what makes
"both replay and live need to drive the same views" true by construction rather than by
convention: there is only one code path from "an event happened" to "the UI shows it."

## 2. Name one real tradeoff you made while building this, and argue for the decision. What did it cost you?

**Tradeoff: the live feed is generated entirely client-side, with no backend process at
all** (`src/live/liveGenerator.ts`, wired through `src/hooks/useLiveFeed.ts`), rather than a
small server that pushes synthetic events over a socket.

**Argument for it**: the brief explicitly allows either approach ("Whether you generate it
from a small server process or purely within the frontend is up to you"), and it directly
satisfies the harder constraint in the same paragraph — "both the replay and the live feed
need to be reachable in your deployed submission." A client-only generator means the deployed
build is a single static site with nothing else to host, keep alive, or wire a WebSocket
through, and it can't drift out of sync with a separate backend deployment. It also let me
reuse the exact same shared pipeline described in Q1 without inventing a second transport.

**What it cost me**: the live feed has no state independent of the current browser tab. It
doesn't survive a page reload, two tabs watching the "same" live session would actually see
two independent simulations, and because nothing is transmitted over an actual network, the
live feed can't demonstrate real network behavior (latency, drops, reconnection) — only
synthetic movement/battery/status generation, which is genuinely a different and smaller
problem than "receive telemetry from a robot over an unreliable connection." If Peppermint
later wanted the live feed to reflect one shared, durable fleet state across multiple
operators' screens, this decision would need to be revisited in favor of a real backend —
discussed further in `SYSTEM_DESIGN.md` Q1 and Q5.

## 3. What did you leave out, and what would you build next given more time?

**Left out**:
- A per-robot historical timeline (only the fleet-level trend is shown; a robot's own history
  beyond its current `RobotRuntimeState` isn't retained anywhere).
- Persistence — the trend history (`FleetState.history`) and everything else lives only in
  React state for the current browser session; a reload starts over.
- Any backend or real robot telemetry ingestion — everything, including "live," runs
  client-side (see Q2).
- Deeper `task_event` handling — the two `task_started`/`task_completed` markers in
  `events.jsonl` are preserved on the normalized `FleetEvent.taskEvent` field
  (`src/domain/normalizeEvent.ts`) but never surfaced in the UI, per the brief's own "nothing
  is graded on them" allowance.
- Authentication or multi-operator awareness — this is a single-session, single-viewer
  dashboard.
- Richer attention alerting (e.g. a toast/notification when a robot newly enters an attention
  state) — the dashboard only shows current attention status, not a change-log of it.

**What I'd build next**: a real backend that ingests actual (or realistically-timed mock)
robot telemetry and exposes it over both REST and WebSocket — the same shape as the
challenge's own backend assignment — so the live feed reflects one durable, shared fleet
state instead of a per-tab simulation, and history survives a reload. On top of that: a
per-robot history view (reusing `deriveFleetHistoryPoint`'s pattern but keyed by robot rather
than fleet-wide), and a small notification/alert log for attention-state transitions, since
right now an operator has to be watching to notice a robot has changed state.
