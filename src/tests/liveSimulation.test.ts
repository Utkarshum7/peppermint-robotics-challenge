import { describe, expect, it } from "vitest";
import type { RobotRuntimeState } from "../domain/models";
import { MAP_HEIGHT, MAP_WIDTH } from "../domain/constants";
import {
  clampToMap,
  moveToward,
  nextBattery,
  nextStatus,
  pickRandomTarget,
  simulateRobotStep,
} from "../live/liveSimulation";

// A scripted rng: returns each value in order, then cycles — gives full,
// deterministic control over which probability checks fire, rather than
// relying on real randomness (which would make tests flaky).
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function robot(overrides: Partial<RobotRuntimeState>): RobotRuntimeState {
  return {
    robotId: "r1",
    position: { x: 400, y: 300 },
    status: "idle",
    battery: 100,
    lastUpdatedAt: 0,
    ...overrides,
  };
}

describe("position generation stays within the map", () => {
  it("pickRandomTarget never leaves the 900x560 bounds, even at rng extremes", () => {
    for (const value of [0, 0.001, 0.5, 0.999, 1]) {
      const target = pickRandomTarget(scripted(value));
      expect(target.x).toBeGreaterThanOrEqual(0);
      expect(target.x).toBeLessThanOrEqual(MAP_WIDTH);
      expect(target.y).toBeGreaterThanOrEqual(0);
      expect(target.y).toBeLessThanOrEqual(MAP_HEIGHT);
    }
  });

  it("clampToMap pulls out-of-range positions back inside the bounds", () => {
    expect(clampToMap({ x: -50, y: -10 })).toEqual({ x: 0, y: 0 });
    expect(clampToMap({ x: 9999, y: 9999 })).toEqual({ x: MAP_WIDTH, y: MAP_HEIGHT });
  });
});

describe("moveToward — incremental movement, never a teleport", () => {
  it("moves at most maxStep units toward a distant target", () => {
    const result = moveToward({ x: 0, y: 0 }, { x: 900, y: 0 }, 25);
    expect(result.x).toBe(25);
    expect(result.y).toBe(0);
  });

  it("snaps to the target once already closer than maxStep, without overshooting", () => {
    const result = moveToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 25);
    expect(result).toEqual({ x: 10, y: 0 });
  });
});

describe("nextBattery — bounded, gradual change", () => {
  it("keeps battery within 0-100 even at extreme charge/drain rolls", () => {
    expect(nextBattery("charging", 99, scripted(1))).toBeLessThanOrEqual(100);
    expect(nextBattery("active", 0.1, scripted(1))).toBeGreaterThanOrEqual(0);
  });

  it("charging increases battery gradually, never by more than a few percent per tick", () => {
    const next = nextBattery("charging", 50, scripted(0.5));
    expect(next).toBeGreaterThan(50);
    expect(next - 50).toBeLessThan(5); // gradual, not an 80->20-style jump
  });

  it("active/on_mission decreases battery gradually", () => {
    const next = nextBattery("active", 50, scripted(0.5));
    expect(next).toBeLessThan(50);
    expect(50 - next).toBeLessThan(5);
  });

  it("maintenance and offline hold battery steady rather than inventing a charger", () => {
    expect(nextBattery("maintenance", 42, scripted(0.9))).toBe(42);
    expect(nextBattery("offline", 42, scripted(0.9))).toBe(42);
  });
});

describe("nextStatus — only valid domain statuses, sensible transitions", () => {
  it("stays on the same status when every probability check fails", () => {
    expect(nextStatus("active", 50, scripted(1))).toBe("active");
    expect(nextStatus("blocked", 50, scripted(1))).toBe("blocked");
  });

  it("a working robot can transition toward charging when its battery is low", () => {
    // fail the blocked/error checks (rng=1), then succeed the low-battery
    // charging check (rng=0)
    const status = nextStatus("active", 10, scripted(1, 1, 0));
    expect(status).toBe("charging");
  });

  it("a fully charged robot has a real chance to leave charging", () => {
    expect(nextStatus("charging", 95, scripted(0))).toBe("idle");
    expect(nextStatus("charging", 95, scripted(1))).toBe("charging");
  });

  it("a charging robot below the completion threshold never recovers early, regardless of rng", () => {
    expect(nextStatus("charging", 50, scripted(0))).toBe("charging");
  });

  it("blocked/error/maintenance/offline can recover to idle but not to a random status", () => {
    expect(nextStatus("blocked", 50, scripted(0))).toBe("idle");
    expect(nextStatus("error", 50, scripted(0))).toBe("idle");
    expect(nextStatus("maintenance", 50, scripted(0))).toBe("idle");
    expect(nextStatus("offline", 50, scripted(0))).toBe("idle");
  });
});

describe("simulateRobotStep — combines status/battery/movement for one robot", () => {
  it("does not move a robot that is not in a working status", () => {
    const before = robot({ status: "charging", position: { x: 400, y: 300 } });
    const result = simulateRobotStep(before, null, 5, scripted(1)); // stays charging
    expect(result.rawEvent.x).toBe(400);
    expect(result.rawEvent.y).toBe(300);
  });

  it("moves a working robot incrementally toward a target, staying in bounds", () => {
    const before = robot({ status: "active", position: { x: 0, y: 0 } });
    // rng sequence: fail blocked/error/charging checks (1,1,1), fail
    // active->on_mission/idle (1,1) so it stays "active", then the target
    // pick / battery draw can use whatever's left in the cycle.
    const result = simulateRobotStep(before, null, 5, scripted(1, 1, 1, 1, 1, 0.5));

    const moved = Math.hypot(result.rawEvent.x - 0, result.rawEvent.y - 0);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(25 + 1e-9); // MAX_STEP_DISTANCE — no teleport (allow float rounding)
    expect(result.rawEvent.x).toBeGreaterThanOrEqual(0);
    expect(result.rawEvent.x).toBeLessThanOrEqual(MAP_WIDTH);
  });

  it("produces only statuses from the real domain status set", () => {
    const validStatuses = [
      "idle", "active", "on_mission", "charging", "blocked", "error", "maintenance", "offline",
    ];
    const before = robot({ status: "idle" });
    const result = simulateRobotStep(before, null, 5, scripted(0.5));
    expect(validStatuses).toContain(result.rawEvent.status);
  });
});
