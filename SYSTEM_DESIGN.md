# SYSTEM_DESIGN.md

System design questions from `Hiring-Challenge.pdf`, answered against the actual frontend
submission in this repository.

---

## 1. What happens if we ask you to add a new feature to this later? Does your current design accommodate that, or does it need a rework? Walk through a specific feature and where it would plug in.

Concrete feature: **notify the operator when a robot newly enters an attention state**
(mentioned as a real gap in `ANSWERS.md` Q3).

The current design accommodates this without a rework, because attention classification is
already centralized (`isWorking`/`needsAttention` in `src/domain/classification.ts`) and
every fleet update already funnels through exactly one reducer case, `APPLY_EVENT`
(`src/state/fleetReducer.ts`). The feature plugs in there: before calling `applyEvent`, read
`needsAttention(state.robots[event.robotId])` for the robot's *current* state; after calling
it, read the same function against the *updated* state; if it flipped `false → true`, push an
entry onto a new `state.alerts` array (a new, small slice of `FleetState`, following the same
pattern as `history`) alongside the existing `robots` update in that one case. A small
`AlertBanner` component would read `state.alerts` the same way `FleetTrendChart` reads
`state.history` — one more consumer of the existing state, not a new data path. Because
replay and live both dispatch the identical `APPLY_EVENT` action, the alert logic would fire
identically regardless of source, with no special-casing needed.

## 2. What happens if the number of robots grows a lot, say from eight to five hundred? What is the first thing that breaks, and why that specifically?

The first thing to break is the **map's rendering approach**, specifically
`src/components/Map/FleetMap.tsx` and `src/components/Map/RobotMarker.tsx`: each robot is a
real DOM `<button>` element, individually positioned and re-rendered by React. That's
deliberately fine at 8 markers — real DOM nodes give free accessibility (each marker is a
genuine focusable, labelled button) and make live behavior easy to inspect in devtools — but
at 500, a single replay tick that updates most of the fleet at once means up to 500
DOM node updates in one frame, which is the kind of thing that causes visible layout jank —
this is the first perceptible failure, well before `FleetState.robots` itself (a plain
`Record`, O(1) per-robot update) becomes a bottleneck. The fix at that scale is a canvas- or
WebGL-based marker layer instead of one DOM node per robot — a real rewrite of that one
component, not the surrounding architecture.

A secondary, slightly later break: `src/components/Search/SearchAndFilter.tsx` renders every
matching result as a DOM row with no virtualization — fine for 8 rows, would need list
virtualization (windowing) once the fleet (or a filtered subset of it) reaches into the
hundreds.

## 3. What happens if bandwidth is limited and robots and the backend can only exchange a small amount of data per second? What would you change about what you send, how often, or how much detail it carries?

The current event shape (`RawFleetEvent` in `src/domain/models.ts`: `t, robot_id, x, y,
status, battery`) is already close to minimal, but under a real bandwidth constraint I'd
change three things: **send deltas, not absolute state** (a small position delta plus a
status/battery field only when they actually change, rather than repeating all five fields
every tick); **reduce update frequency for low-priority robots** (a robot sitting `idle` or
`charging` doesn't need a 5-second cadence — only `active`/`on_mission` robots, and any robot
that just crossed into an attention state, would justify frequent updates); and **quantize
precision** (fewer decimal places on position/battery — the current data already carries more
precision, e.g. `569.9`, than an operator dashboard needs). None of this changes
`src/domain/validateEvent.ts`'s job conceptually — it would just validate a smaller, more
optional-field-tolerant shape, and `normalizeEvent.ts` would fill in unchanged fields from the
robot's last known state rather than assuming every field is always present.

## 4. What happens if a robot goes down mid task and stops responding? What should the rest of the system do about it, and how would it even find out?

Today, nothing detects a robot's *silence* — `applyEvent` (`src/domain/applyEvent.ts`) only
reacts to events that arrive; a robot that simply stops sending them keeps showing whatever
status it last reported (e.g. `on_mission`), which is misleading. The system would find out
via a **staleness check**: compare each robot's `lastUpdatedAt` against the current recorded
tick (`state.replay.currentTick`) or live tick (`state.live.tick`), and if the gap exceeds a
threshold, treat the robot as stale regardless of its last-reported status. This is a small,
targeted addition — a pure `isStale(robot, currentTime, thresholdSeconds)` function alongside
the existing ones in `src/domain/classification.ts`, folded into `needsAttention`'s
definition — not a change to how events are applied. Deliberately, this would **not**
overwrite the robot's `status` field with something invented like `"offline"`; we don't
actually know what happened to it, only that it stopped reporting, so the UI should show "no
update in Ns" as its own signal rather than fabricate a status the robot never sent.

## 5. What happens if the connection between a robot and the backend is slow or unreliable, and updates arrive late, out of order, or not at all for a while? What does the rest of the system see during that time, and how does it recover once the connection is healthy again?

This one exposes a real, honest gap in the current implementation, not just a hypothetical:
`applyEvent` unconditionally overwrites `position`/`status`/`battery`/`lastUpdatedAt` with
whatever the incoming event says — it never checks whether `event.t` is actually newer than
the robot's current `lastUpdatedAt`. Against the real `events.jsonl` this is safe, because the
file is verified strictly ordered. It would **not** be safe against a genuinely unreliable
connection, where a delayed, out-of-order event could silently regress a robot's displayed
state to something older. The fix belongs in exactly one place: add a guard at the top of
`applyEvent` — `if (event.t <= existing.lastUpdatedAt) return robots;` — so a late-arriving
stale event is dropped instead of applied, the same "last-write-wins by timestamp" pattern
used broadly for this class of problem. During an outage, the rest of the system would keep
showing the robot's last genuinely-known state (increasingly stale per Q4's check, but never
wrong-because-overwritten-by-old-data); once the connection recovers, a burst of
backlogged/reordered events would flow through the same pipeline, with the timestamp guard
ensuring only the actually-newest one per robot wins, and `lastUpdatedAt`/the staleness check
naturally clearing once a fresh event lands.
