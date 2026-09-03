import { describe, expect, it } from "vitest";
import type { RobotDefinition } from "../domain/models";
import { createInitialFleetState } from "../domain/createInitialFleetState";

// Fixture mirrors the actual shape/values in robots.json (r1 and r2), not
// invented data.
const fixtureRobots: RobotDefinition[] = [
  { robotId: "r1", robotType: "picker", start: { x: 569.9, y: 33.0 } },
  { robotId: "r2", robotType: "hauler", start: { x: 787.3, y: 65.2 } },
];

describe("createInitialFleetState", () => {
  it("creates one runtime entry per robot, positioned at its start coordinates", () => {
    const result = createInitialFleetState(fixtureRobots);

    expect(Object.keys(result)).toEqual(["r1", "r2"]);
    expect(result.r1.position).toEqual({ x: 569.9, y: 33.0 });
    expect(result.r2.position).toEqual({ x: 787.3, y: 65.2 });
  });

  it("starts every robot idle at full battery, since robots.json carries no status/battery", () => {
    const result = createInitialFleetState(fixtureRobots);

    for (const robotId of Object.keys(result)) {
      expect(result[robotId].status).toBe("idle");
      expect(result[robotId].battery).toBe(100);
    }
  });

  it("returns an empty state for an empty roster rather than throwing", () => {
    expect(createInitialFleetState([])).toEqual({});
  });
});
