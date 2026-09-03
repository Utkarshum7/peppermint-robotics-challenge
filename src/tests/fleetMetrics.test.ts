import { describe, expect, it } from "vitest";
import type { RobotRuntimeState } from "../domain/models";
import { computeFleetMetrics, deriveFleetHistoryPoint } from "../domain/fleetMetrics";

function robot(overrides: Partial<RobotRuntimeState>): RobotRuntimeState {
  return {
    robotId: "r1",
    position: { x: 0, y: 0 },
    status: "idle",
    battery: 100,
    lastUpdatedAt: 0,
    ...overrides,
  };
}

describe("computeFleetMetrics", () => {
  it("counts only active/on_mission as working — not idle or charging", () => {
    const robots: Record<string, RobotRuntimeState> = {
      r1: robot({ robotId: "r1", status: "active" }),
      r2: robot({ robotId: "r2", status: "on_mission" }),
      r3: robot({ robotId: "r3", status: "idle" }),
      r4: robot({ robotId: "r4", status: "charging" }),
    };

    expect(computeFleetMetrics(robots).workingCount).toBe(2);
  });

  it("counts blocked/error/offline/maintenance and low battery as needing attention", () => {
    const robots: Record<string, RobotRuntimeState> = {
      r1: robot({ robotId: "r1", status: "blocked" }),
      r2: robot({ robotId: "r2", status: "active", battery: 5 }), // working AND low battery
      r3: robot({ robotId: "r3", status: "idle", battery: 90 }), // neither
    };

    const metrics = computeFleetMetrics(robots);
    expect(metrics.attentionCount).toBe(2);
    expect(metrics.workingCount).toBe(1); // r2 still counts as working too
  });

  it("computes the average battery across all robots", () => {
    const robots: Record<string, RobotRuntimeState> = {
      r1: robot({ robotId: "r1", battery: 100 }),
      r2: robot({ robotId: "r2", battery: 50 }),
      r3: robot({ robotId: "r3", battery: 0 }),
    };

    expect(computeFleetMetrics(robots).averageBattery).toBeCloseTo(50);
  });

  it("returns zeroed metrics for an empty fleet rather than dividing by zero", () => {
    expect(computeFleetMetrics({})).toEqual({
      totalRobots: 0,
      workingCount: 0,
      attentionCount: 0,
      averageBattery: 0,
    });
  });
});

describe("deriveFleetHistoryPoint", () => {
  it("reports 100% working when every robot is active/on_mission", () => {
    const robots: Record<string, RobotRuntimeState> = {
      r1: robot({ robotId: "r1", status: "active" }),
      r2: robot({ robotId: "r2", status: "on_mission" }),
    };

    expect(deriveFleetHistoryPoint(robots, 60)).toEqual({
      t: 60,
      workingPercentage: 100,
      attentionCount: 0,
    });
  });

  it("reports 0% working when no robot is active/on_mission", () => {
    const robots: Record<string, RobotRuntimeState> = {
      r1: robot({ robotId: "r1", status: "idle" }),
      r2: robot({ robotId: "r2", status: "charging" }),
    };

    expect(deriveFleetHistoryPoint(robots, 60).workingPercentage).toBe(0);
  });

  it("computes the correct percentage for a mixed fleet, using the centralized working classification", () => {
    const robots: Record<string, RobotRuntimeState> = {
      r1: robot({ robotId: "r1", status: "active" }),
      r2: robot({ robotId: "r2", status: "idle" }),
      r3: robot({ robotId: "r3", status: "on_mission" }),
      r4: robot({ robotId: "r4", status: "blocked" }),
    };

    const point = deriveFleetHistoryPoint(robots, 60);
    expect(point.workingPercentage).toBe(50); // 2 of 4 working
    expect(point.attentionCount).toBe(1); // blocked
  });

  it("carries the supplied t through unchanged — it has no opinion on which clock produced it", () => {
    expect(deriveFleetHistoryPoint({}, 12345).t).toBe(12345);
  });
});
