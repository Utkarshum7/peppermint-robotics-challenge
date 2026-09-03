import { describe, expect, it } from "vitest";
import type { RobotDefinition } from "../domain/models";
import { createEmptyFleetState, fleetReducer } from "../state/fleetReducer";
import { MAX_HISTORY_POINTS } from "../domain/constants";

// History is the one piece of behavior that lives directly in the
// reducer's tick-advance cases (see fleetReducer.ts's header comment)
// rather than in a pure helper, so it's exercised here directly against
// the reducer.

const fixtureRobots: RobotDefinition[] = [
  { robotId: "r1", robotType: "picker", start: { x: 0, y: 0 } },
  { robotId: "r2", robotType: "hauler", start: { x: 10, y: 10 } },
];

function initializedState() {
  return fleetReducer(createEmptyFleetState(), { type: "INITIALIZE_FLEET", robots: fixtureRobots });
}

describe("fleetReducer — replay history", () => {
  it("records one history point per ADVANCE_REPLAY_TICK, reflecting current fleet state", () => {
    let state = initializedState();
    state = fleetReducer(state, {
      type: "APPLY_EVENT",
      event: { t: 0, robotId: "r1", position: { x: 1, y: 1 }, status: "active", battery: 90 },
    });
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 0 });

    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({ t: 0, workingPercentage: 50 }); // r1 working, r2 idle
  });

  it("keeps history chronological across multiple ticks", () => {
    let state = initializedState();
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 0 });
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 5 });
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 10 });

    expect(state.history.map((p) => p.t)).toEqual([0, 5, 10]);
  });

  it("does not append a history point for actions unrelated to a fleet tick", () => {
    let state = initializedState();
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 0 });
    const historyAfterTick = state.history;

    state = fleetReducer(state, { type: "SELECT_ROBOT", robotId: "r1" });
    state = fleetReducer(state, { type: "SET_REPLAY_SPEED", speedMultiplier: 5 });

    expect(state.history).toBe(historyAfterTick); // same reference — nothing appended
  });

  it("RESET_REPLAY clears history to [], rather than seeding a t=0 point that would collide with the first real tick", () => {
    // A synthetic t=0 baseline point here would collide with the real t=0
    // point that replayEngine.ts's own "apply the first group immediately
    // on Play" behavior appends right after Reset — two points claiming
    // the same t is both a React key collision and a genuinely ambiguous
    // chart reading. This confirms Reset produces an empty history
    // instead, so the very next tick supplies the one true t=0 point.
    let state = initializedState();
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 0 });
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 5 });
    expect(state.history.length).toBeGreaterThan(1);

    state = fleetReducer(state, { type: "RESET_REPLAY", robots: fixtureRobots });
    expect(state.history).toEqual([]);

    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 0 });
    expect(state.history).toHaveLength(1); // exactly one t=0 point, not two
    expect(state.history[0].t).toBe(0);
  });

  it("bounds history at MAX_HISTORY_POINTS, dropping the oldest", () => {
    let state = initializedState();
    for (let t = 0; t < MAX_HISTORY_POINTS + 10; t++) {
      state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: t });
    }

    expect(state.history).toHaveLength(MAX_HISTORY_POINTS);
    expect(state.history[0].t).toBe(10); // oldest 10 dropped
    expect(state.history[state.history.length - 1].t).toBe(MAX_HISTORY_POINTS + 9);
  });
});

describe("fleetReducer — mode switching and history separation", () => {
  it("clears history on an actual mode change, so replay and live timelines are never mixed", () => {
    let state = initializedState();
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 0 });
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 5 });
    expect(state.history).toHaveLength(2);

    state = fleetReducer(state, { type: "SET_MODE", mode: "live" });
    expect(state.history).toEqual([]);

    state = fleetReducer(state, { type: "ADVANCE_LIVE_TICK", tick: 5 });
    // The live point's t happens to collide with a recorded t used above,
    // but it's the only point present — proof the two timelines aren't
    // sharing an array.
    expect(state.history).toHaveLength(1);
  });

  it("does not clear history when SET_MODE is dispatched for the mode that's already active", () => {
    let state = initializedState();
    state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: 0 });
    const historyBefore = state.history;

    state = fleetReducer(state, { type: "SET_MODE", mode: "replay" }); // already "replay"

    expect(state.history).toBe(historyBefore); // same reference — no-op
  });

  it("records live history using the synthetic tick clock, independent of replay's timestamp", () => {
    let state = initializedState();
    state = fleetReducer(state, { type: "SET_MODE", mode: "live" });
    state = fleetReducer(state, { type: "ADVANCE_LIVE_TICK", tick: 5 });
    state = fleetReducer(state, { type: "ADVANCE_LIVE_TICK", tick: 10 });

    expect(state.history.map((p) => p.t)).toEqual([5, 10]);
  });

  it("resets live.tick to 0 on mode switch rather than inheriting replay's clock", () => {
    // Run replay well past a point where inheriting it would look wrong.
    let state = initializedState();
    for (let t = 0; t <= 400; t += 5) {
      state = fleetReducer(state, { type: "ADVANCE_REPLAY_TICK", currentTick: t });
    }
    expect(state.replay.currentTick).toBe(400);

    state = fleetReducer(state, { type: "SET_MODE", mode: "live" });

    expect(state.live).toEqual({ status: "idle", tick: 0 }); // NOT 400
  });

  it("live.tick continues (isn't reset) across Stop/Start within the same mode session", () => {
    let state = initializedState();
    state = fleetReducer(state, { type: "SET_MODE", mode: "live" });
    state = fleetReducer(state, { type: "ADVANCE_LIVE_TICK", tick: 40 });
    state = fleetReducer(state, { type: "SET_LIVE_STATUS", status: "idle" }); // "Stop"

    expect(state.live.tick).toBe(40); // stopping doesn't rewind the clock
  });
});
