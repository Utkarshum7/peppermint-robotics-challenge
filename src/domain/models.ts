// Domain models for the fleet dashboard.
//
// Two shapes exist for "a robot" and they are never merged into one object:
//
// - RobotDefinition: static metadata from robots.json. Loaded once, never changes.
// - RobotRuntimeState: dynamic per-robot state, produced and updated by applyEvent
//   as events (replay or live) arrive.
//
// A view that needs both (e.g. "this hauler is on_mission at (x,y)") joins them
// by robotId at read time — see data/robots.ts + the selector layer, not here.

export interface Position {
  x: number;
  y: number;
}

export type RobotType = "picker" | "hauler";

// Matches robots.json exactly: { robot_id, robot_type, start: { x, y } }
export interface RobotDefinition {
  robotId: string;
  robotType: RobotType;
  start: Position;
}

// The 8 statuses actually present in events.jsonl (verified directly against the
// file — all 8 named in the challenge brief occur, none are missing or extra).
export type RobotStatus =
  | "idle"
  | "active"
  | "on_mission"
  | "charging"
  | "blocked"
  | "error"
  | "maintenance"
  | "offline";

// Single source of truth for "is this a recognized status" — used by
// validateEvent. Kept separate from classification.ts's status groupings,
// which are about what a status *means* (working/attention), not whether
// it's a valid value at all.
export const ALL_ROBOT_STATUSES: readonly RobotStatus[] = [
  "idle",
  "active",
  "on_mission",
  "charging",
  "blocked",
  "error",
  "maintenance",
  "offline",
];

export type TaskEvent = "task_started" | "task_completed";

// Dynamic, one entry per robot, replaced wholesale by applyEvent when that
// robot's next event arrives. Never holds robotType/start — those live only
// on RobotDefinition.
export interface RobotRuntimeState {
  robotId: string;
  position: Position;
  status: RobotStatus;
  battery: number;
  lastUpdatedAt: number;
}

// Raw shape as it appears on the wire / in events.jsonl (snake_case, flat x/y).
export interface RawFleetEvent {
  t: number;
  robot_id: string;
  x: number;
  y: number;
  status: string;
  battery: number;
  task_event?: TaskEvent;
}

// Normalized shape, safe to hand to applyEvent. Produced by validateEvent.
export interface FleetEvent {
  t: number;
  robotId: string;
  position: Position;
  status: RobotStatus;
  battery: number;
  taskEvent?: TaskEvent;
}

export type AppMode = "replay" | "live";

export interface ReplayState {
  status: "idle" | "playing" | "paused" | "completed";
  currentTick: number;
  speedMultiplier: number;
}

// Live mode has no cursor/speed/completion the way replay does — it either
// generates indefinitely or it doesn't. `tick` is a synthetic elapsed-time
// counter (seconds) — its own clock, independent of replay's. It resets to
// 0 every time SET_MODE actually switches into "live" (fleetReducer.ts), so
// a fresh Live session always starts from an understandable baseline rather
// than inheriting wherever replay's own timeline happened to be — seeding
// it from replay.currentTick would make a "fresh" live session immediately
// show a large, borrowed number after a long replay run. Stopping and
// restarting Live without switching modes continues from this same tick,
// same as pausing/resuming — only an actual mode switch resets it.
export interface LiveState {
  status: "idle" | "running";
  tick: number;
}

// t is recorded seconds (replay, 0-900) OR synthetic elapsed seconds (live)
// — never both in the same array; see fleetReducer.ts's SET_MODE case for
// why they're never mixed. attentionCount rides
// along for the chart's tooltip/current-value readout without needing a
// second array — see domain/fleetMetrics.ts's deriveFleetHistoryPoint.
export interface FleetHistoryPoint {
  t: number;
  workingPercentage: number;
  attentionCount: number;
}

// Search text and the attention-only toggle are deliberately NOT here.
// They're operator view state, not fleet data, and there's exactly
// one component that reads them — components/Search/SearchAndFilter.tsx
// holds them as local useState instead, since state nothing else in the
// app needs doesn't belong in the shared reducer.
export interface FleetState {
  robots: Record<string, RobotRuntimeState>;
  selectedRobotId: string | null;
  mode: AppMode;
  replay: ReplayState;
  live: LiveState;
  history: FleetHistoryPoint[];
}
