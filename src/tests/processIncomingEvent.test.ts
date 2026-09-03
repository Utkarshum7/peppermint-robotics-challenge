import { describe, expect, it } from "vitest";
import type { RobotRuntimeState } from "../domain/models";
import { createInitialFleetState } from "../domain/createInitialFleetState";
import { processIncomingEvent, toFleetEvent } from "../domain/processIncomingEvent";

function baseline(): Record<string, RobotRuntimeState> {
  return createInitialFleetState([
    { robotId: "r3", robotType: "picker", start: { x: 382.9, y: 35.5 } },
    { robotId: "r6", robotType: "hauler", start: { x: 578.9, y: 303.4 } },
  ]);
}

describe("processIncomingEvent — full pipeline (validate -> normalize -> apply)", () => {
  it("carries a real raw event from events.jsonl through to updated robot state", () => {
    // The actual t=380 line for r3 in the recorded log.
    const raw = { t: 380, robot_id: "r3", x: 334.1, y: 29.1, status: "on_mission", battery: 34.4, task_event: "task_started" };

    const result = processIncomingEvent(raw, baseline());

    expect(result.rejected).toBeUndefined();
    expect(result.event?.robotId).toBe("r3");
    expect(result.robots.r3).toMatchObject({
      position: { x: 334.1, y: 29.1 },
      status: "on_mission",
      battery: 34.4,
      lastUpdatedAt: 380,
    });
  });

  it("rejects a malformed raw event before it ever reaches applyEvent", () => {
    const before = baseline();
    const malformed = { t: 380, robot_id: "r3", x: 334.1, y: 29.1, status: "sleeping", battery: 34.4 };

    const result = processIncomingEvent(malformed, before);

    expect(result.rejected).toBeDefined();
    expect(result.event).toBeNull();
    expect(result.robots).toBe(before); // untouched — nothing was applied
  });

  it("preserves task_event on the normalized event without adding it to robot runtime state", () => {
    // The actual t=55 line for r6 in the recorded log.
    const raw = { t: 55, robot_id: "r6", x: 602.7, y: 344.8, status: "on_mission", battery: 43.7, task_event: "task_completed" };

    const result = processIncomingEvent(raw, baseline());

    expect(result.event?.taskEvent).toBe("task_completed");
    // RobotRuntimeState has no task-related field at all (see domain/models.ts) —
    // task_event is preserved as event metadata only, describing what happened
    // during this event rather than a piece of the robot's ongoing state.
    expect(result.robots.r6).not.toHaveProperty("taskEvent");
  });
});

describe("toFleetEvent — validate + normalize without applying", () => {
  it("returns a normalized event for valid raw input", () => {
    const raw = { t: 0, robot_id: "r1", x: 569.9, y: 33.0, status: "idle", battery: 84.4 };
    const result = toFleetEvent(raw);

    expect("event" in result).toBe(true);
    if ("event" in result) {
      expect(result.event).toEqual({
        t: 0,
        robotId: "r1",
        position: { x: 569.9, y: 33.0 },
        status: "idle",
        battery: 84.4,
        taskEvent: undefined,
      });
    }
  });

  it("returns a rejection reason for invalid raw input, without touching any state", () => {
    const result = toFleetEvent({ t: "not-a-number" });
    expect("rejected" in result).toBe(true);
  });
});
