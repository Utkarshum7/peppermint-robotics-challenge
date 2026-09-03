// The fleet reducer. This is the only place FleetState is ever produced.
//
// APPLY_EVENT carries an already-normalized FleetEvent, not a raw one —
// validation/normalization (domain/validateEvent.ts, domain/normalizeEvent.ts)
// happens upstream, before anything is dispatched, whether the event came
// from replay or from the live generator. The reducer's only job here is
// calling the pure applyEvent transition and returning the result; it is
// never responsible for parsing or validating external data itself, and it
// has no idea which source produced any given event.
//
// The replay actions (SET_REPLAY_STATUS, SET_REPLAY_SPEED,
// ADVANCE_REPLAY_TICK, RESET_REPLAY) are dispatched by hooks/useReplay.ts in
// response to replay/replayEngine.ts's callbacks. The live actions
// (SET_LIVE_STATUS, ADVANCE_LIVE_TICK) are dispatched by hooks/useLiveFeed.ts
// in response to live/liveGenerator.ts's callbacks. Neither engine touches
// FleetState directly. RESET_REPLAY reuses createInitialFleetState rather
// than re-deriving a baseline here a second time.
//
// SET_MODE just records which mode is selected — it does not itself stop
// either engine. Mode exclusivity (only one engine's timer ever running) is
// enforced by ModeControls.tsx, which explicitly pauses/stops the other
// engine before dispatching SET_MODE.
//
// Fleet trend history has no dedicated APPEND_HISTORY_POINT action — it's
// folded directly into ADVANCE_REPLAY_TICK and ADVANCE_LIVE_TICK instead.
// Both of those already fire exactly once per logical tick, AFTER that
// tick's APPLY_EVENT dispatches have already run (see useReplay.ts's/
// useLiveFeed.ts's onApplyGroup/onGenerateEvents — every APPLY_EVENT for a
// tick is dispatched before the tick-advance action), so state.robots here
// already reflects the whole tick. This is the ONE place a history point is
// ever recorded — nothing else appends to state.history, so a UI-only
// render (selection, search, speed change) cannot produce a duplicate point
// by construction, not just by care. SET_MODE clears history on an actual
// mode change, and RESET_REPLAY clears it too — see their cases below for why.

import type {
  AppMode,
  FleetEvent,
  FleetHistoryPoint,
  FleetState,
  LiveState,
  ReplayState,
  RobotDefinition,
} from "../domain/models";
import { createInitialFleetState } from "../domain/createInitialFleetState";
import { applyEvent } from "../domain/applyEvent";
import { deriveFleetHistoryPoint } from "../domain/fleetMetrics";
import { MAX_HISTORY_POINTS } from "../domain/constants";

// Bounded append: keeps at most MAX_HISTORY_POINTS, dropping the oldest
// once the limit is exceeded. Replay's own 181 ticks never reach the
// bound; only a long-running live session can.
function appendHistoryPoint(
  history: FleetHistoryPoint[],
  point: FleetHistoryPoint,
): FleetHistoryPoint[] {
  const next = [...history, point];
  return next.length > MAX_HISTORY_POINTS ? next.slice(next.length - MAX_HISTORY_POINTS) : next;
}

export type FleetAction =
  | { type: "INITIALIZE_FLEET"; robots: RobotDefinition[] }
  | { type: "APPLY_EVENT"; event: FleetEvent }
  | { type: "SELECT_ROBOT"; robotId: string | null }
  | { type: "SET_REPLAY_STATUS"; status: ReplayState["status"] }
  | { type: "SET_REPLAY_SPEED"; speedMultiplier: number }
  | { type: "ADVANCE_REPLAY_TICK"; currentTick: number }
  | { type: "RESET_REPLAY"; robots: RobotDefinition[] }
  | { type: "SET_MODE"; mode: AppMode }
  | { type: "SET_LIVE_STATUS"; status: LiveState["status"] }
  | { type: "ADVANCE_LIVE_TICK"; tick: number };

export function createEmptyFleetState(): FleetState {
  return {
    robots: {},
    selectedRobotId: null,
    mode: "replay",
    replay: { status: "idle", currentTick: 0, speedMultiplier: 1 },
    live: { status: "idle", tick: 0 },
    history: [],
  };
}

export function fleetReducer(state: FleetState, action: FleetAction): FleetState {
  switch (action.type) {
    case "INITIALIZE_FLEET":
      return {
        ...state,
        robots: createInitialFleetState(action.robots),
      };
    case "APPLY_EVENT":
      return {
        ...state,
        robots: applyEvent(state.robots, action.event),
      };
    case "SELECT_ROBOT":
      // selectedRobotId is the only thing this action touches — robot
      // runtime data (state.robots) never gets a `selected` field of its
      // own. The selected robot's current details are derived by looking
      // it up in state.robots wherever they're displayed.
      return {
        ...state,
        selectedRobotId: action.robotId,
      };
    case "SET_REPLAY_STATUS":
      return {
        ...state,
        replay: { ...state.replay, status: action.status },
      };
    case "SET_REPLAY_SPEED":
      return {
        ...state,
        replay: { ...state.replay, speedMultiplier: action.speedMultiplier },
      };
    case "ADVANCE_REPLAY_TICK":
      // currentTick holds the recorded timestamp (t, in seconds) of the
      // most recently applied group — not an array index — so the UI can
      // show "t = Ns / 900s" directly without needing the group list itself.
      // state.robots already reflects this tick's events (see header
      // comment), so the history point recorded here is for the fleet as
      // it actually stood at this recorded moment, not a stale snapshot.
      return {
        ...state,
        replay: { ...state.replay, currentTick: action.currentTick },
        history: appendHistoryPoint(
          state.history,
          deriveFleetHistoryPoint(state.robots, action.currentTick),
        ),
      };
    case "RESET_REPLAY": {
      // Restores the exact baseline (idle, 100%, robots.json start
      // positions) via the same pure function INITIALIZE_FLEET uses — no
      // second copy of "what does a fresh fleet look like". Replay progress
      // resets to the start; the user's chosen speed is kept, since Reset
      // is about playback position, not their speed preference. Selection
      // is deliberately left untouched — Reset isn't specified to clear it.
      //
      // History clears to [], not a synthetic baseline point: Play always
      // applies the real recorded t=0 group immediately (see
      // replay/replayEngine.ts's "no unnecessary initial wait" behavior),
      // which itself appends a genuine t=0 history point. A pre-seeded
      // baseline point here would leave two points both claiming t=0 with
      // different values — a fabricated baseline vs. the real recorded
      // reading — which is ambiguous on a time axis and gives React two
      // list items with the same key. Clearing to [] and letting the first
      // real tick supply the one true t=0 point avoids that entirely.
      const robots = createInitialFleetState(action.robots);
      return {
        ...state,
        robots,
        replay: { status: "idle", currentTick: 0, speedMultiplier: state.replay.speedMultiplier },
        history: [],
      };
    }
    case "SET_MODE": {
      // Recorded time (0-900s) and live's synthetic elapsed seconds are
      // different clocks that both happen to populate the same t field —
      // plotting them on one continuous timeline would be genuinely
      // misleading (a chart appearing to jump backward or forward in time
      // for no real reason). Clearing history on an actual mode change is
      // the simplest way to guarantee the chart never mixes them; a no-op
      // guard (below) means re-clicking the already-active tab doesn't
      // needlessly wipe an in-progress trend.
      //
      // live is also reset to its own {idle, tick: 0} baseline here, so
      // Live's synthetic clock is never derived from Replay's: seeding it
      // from state.replay.currentTick would make a fresh Live session
      // after a long replay run immediately show a large, replay-borrowed
      // number instead of an understandable fresh baseline. Resetting on
      // every actual mode change means every arrival at Live mode starts
      // clean.
      if (action.mode === state.mode) return state;
      return {
        ...state,
        mode: action.mode,
        history: [],
        live: { status: "idle", tick: 0 },
      };
    }
    case "SET_LIVE_STATUS":
      return {
        ...state,
        live: { ...state.live, status: action.status },
      };
    case "ADVANCE_LIVE_TICK":
      // Same reasoning as ADVANCE_REPLAY_TICK, using live's synthetic
      // elapsed-seconds clock instead of recorded time.
      return {
        ...state,
        live: { ...state.live, tick: action.tick },
        history: appendHistoryPoint(state.history, deriveFleetHistoryPoint(state.robots, action.tick)),
      };
    default:
      return state;
  }
}
