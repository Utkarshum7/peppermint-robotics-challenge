import { describe, expect, it } from "vitest";
import type { RawFleetEvent } from "../domain/models";
import { groupEventsByTimestamp } from "../replay/timestampGroups";

// Shaped like the real dataset's t=0 block (all 8 robots, same timestamp).
const t0: RawFleetEvent[] = [
  { t: 0, robot_id: "r1", x: 569.9, y: 33.0, status: "idle", battery: 84.4 },
  { t: 0, robot_id: "r2", x: 787.3, y: 65.2, status: "idle", battery: 75.8 },
  { t: 0, robot_id: "r3", x: 382.9, y: 35.5, status: "idle", battery: 47.1 },
];
const t5: RawFleetEvent[] = [
  { t: 5, robot_id: "r1", x: 570.1, y: 33.2, status: "active", battery: 84.3 },
];

describe("groupEventsByTimestamp", () => {
  it("groups events sharing a timestamp into one logical replay moment", () => {
    const groups = groupEventsByTimestamp([...t0, ...t5]);

    expect(groups).toHaveLength(2);
    expect(groups[0].t).toBe(0);
    expect(groups[0].events).toHaveLength(3);
    expect(groups[1].t).toBe(5);
    expect(groups[1].events).toHaveLength(1);
  });

  it("preserves source order within a group rather than sorting it", () => {
    const groups = groupEventsByTimestamp([...t0]);
    expect(groups[0].events.map((e) => e.robot_id)).toEqual(["r1", "r2", "r3"]);
  });

  it("preserves group order across the whole sequence", () => {
    const groups = groupEventsByTimestamp([...t0, ...t5]);
    expect(groups.map((g) => g.t)).toEqual([0, 5]);
  });

  it("returns an empty list for no events", () => {
    expect(groupEventsByTimestamp([])).toEqual([]);
  });
});
