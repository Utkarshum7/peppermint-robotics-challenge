import { describe, expect, it } from "vitest";
import type { RobotRuntimeState } from "../domain/models";
import { filterRobots, matchesSearchQuery } from "../components/Search/searchFiltering";

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

describe("matchesSearchQuery", () => {
  it("matches an exact robot ID", () => {
    expect(matchesSearchQuery("r3", "r3")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesSearchQuery("r3", "R3")).toBe(true);
    expect(matchesSearchQuery("r3", "r3".toUpperCase())).toBe(true);
  });

  it("matches partial queries, including a bare number", () => {
    expect(matchesSearchQuery("r3", "3")).toBe(true);
    expect(matchesSearchQuery("r3", "r")).toBe(true);
  });

  it("does not match an unrelated query", () => {
    expect(matchesSearchQuery("r3", "r7")).toBe(false);
  });

  it("treats an empty or whitespace-only query as matching everything", () => {
    expect(matchesSearchQuery("r3", "")).toBe(true);
    expect(matchesSearchQuery("r3", "   ")).toBe(true);
  });
});

describe("filterRobots", () => {
  const fleet: RobotRuntimeState[] = [
    robot({ robotId: "r1", status: "active", battery: 90 }), // working, fine
    robot({ robotId: "r2", status: "idle", battery: 100 }), // fine
    robot({ robotId: "r3", status: "blocked", battery: 80 }), // attention: status
    robot({ robotId: "r4", status: "error", battery: 80 }), // attention: status
    robot({ robotId: "r5", status: "offline", battery: 80 }), // attention: status
    robot({ robotId: "r6", status: "maintenance", battery: 80 }), // attention: status
    robot({ robotId: "r7", status: "active", battery: 5 }), // attention: low battery only
  ];

  it("in 'all' mode with no query, returns every robot", () => {
    expect(filterRobots(fleet, "", "all")).toHaveLength(fleet.length);
  });

  it("in 'all' mode, narrows by search query", () => {
    const results = filterRobots(fleet, "r3", "all");
    expect(results.map((r) => r.robotId)).toEqual(["r3"]);
  });

  it("returns no results for a query that matches nothing", () => {
    expect(filterRobots(fleet, "r9", "all")).toEqual([]);
  });

  it("in 'attention' mode with no query, returns exactly the attention-worthy robots via the centralized classification", () => {
    const results = filterRobots(fleet, "", "attention");
    expect(results.map((r) => r.robotId).sort()).toEqual(["r3", "r4", "r5", "r6", "r7"]);
  });

  it("excludes normal robots from the attention filter", () => {
    const results = filterRobots(fleet, "", "attention");
    expect(results.some((r) => r.robotId === "r1")).toBe(false);
    expect(results.some((r) => r.robotId === "r2")).toBe(false);
  });

  it("combines attention mode with a search query", () => {
    expect(filterRobots(fleet, "r4", "attention").map((r) => r.robotId)).toEqual(["r4"]);
    // r1 is working/fine — matches the query but not the attention filter.
    expect(filterRobots(fleet, "r1", "attention")).toEqual([]);
  });

  it("derives from whatever robot list it's given — proving it isn't a cached/independent list", () => {
    const before = filterRobots(fleet, "", "attention");
    expect(before).toHaveLength(5);

    // Simulate r3 recovering (as a real replay/live event would do via applyEvent).
    const recovered = fleet.map((r) => (r.robotId === "r3" ? { ...r, status: "idle" as const } : r));
    const after = filterRobots(recovered, "", "attention");
    expect(after.some((r) => r.robotId === "r3")).toBe(false);
    expect(after).toHaveLength(4);
  });
});
