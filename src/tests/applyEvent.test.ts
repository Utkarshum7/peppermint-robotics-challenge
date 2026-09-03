import { describe, expect, it, vi } from "vitest";
import type { FleetEvent, RobotRuntimeState } from "../domain/models";
import { createInitialFleetState } from "../domain/createInitialFleetState";
import { applyEvent } from "../domain/applyEvent";

function baseline(): Record<string, RobotRuntimeState> {
  return createInitialFleetState([
    { robotId: "r1", robotType: "picker", start: { x: 569.9, y: 33.0 } },
    { robotId: "r2", robotType: "hauler", start: { x: 787.3, y: 65.2 } },
  ]);
}

// Mirrors the real t=0 line for r1 in events.jsonl.
const r1Event: FleetEvent = {
  t: 0,
  robotId: "r1",
  position: { x: 569.9, y: 33.0 },
  status: "idle",
  battery: 84.4,
};

describe("applyEvent", () => {
  it("updates only the targeted robot, leaving the other untouched by reference", () => {
    const before = baseline();
    const after = applyEvent(before, r1Event);

    expect(after.r1.battery).toBe(84.4);
    expect(after.r2).toBe(before.r2); // same object reference — never rebuilt
  });

  it("does not mutate the input state or the robot object it replaces", () => {
    const before = baseline();
    const originalR1 = before.r1;

    applyEvent(before, r1Event);

    expect(before.r1).toBe(originalR1);
    expect(before.r1.battery).toBe(100); // still the idle/100% baseline, untouched
  });

  it("replaces position, status, and battery together without losing robotId", () => {
    const before = baseline();
    const after = applyEvent(before, {
      t: 60,
      robotId: "r2",
      position: { x: 700, y: 100 },
      status: "on_mission",
      battery: 55.5,
    });

    expect(after.r2).toEqual({
      robotId: "r2",
      position: { x: 700, y: 100 },
      status: "on_mission",
      battery: 55.5,
      lastUpdatedAt: 60,
    });
  });

  it("replaces the idle/100% baseline once a real event arrives for that robot", () => {
    const before = baseline();
    expect(before.r1.status).toBe("idle");
    expect(before.r1.battery).toBe(100);

    const after = applyEvent(before, r1Event);

    expect(after.r1.battery).toBe(84.4); // the real recorded value, not the baseline
  });

  it("safely ignores an event for an unknown robot ID instead of crashing or creating one", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = baseline();

    const after = applyEvent(before, {
      t: 5,
      robotId: "r99",
      position: { x: 0, y: 0 },
      status: "idle",
      battery: 50,
    });

    expect(after).toBe(before); // unchanged reference
    expect(after.r99).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
