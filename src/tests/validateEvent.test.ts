import { describe, expect, it } from "vitest";
import { validateEvent } from "../domain/validateEvent";

// The valid fixture is the actual first line of events.jsonl.
const realEvent = { t: 0, robot_id: "r1", x: 569.9, y: 33.0, status: "idle", battery: 84.4 };

describe("validateEvent", () => {
  it("accepts a real telemetry event from the dataset", () => {
    const result = validateEvent(realEvent);
    expect(result.valid).toBe(true);
  });

  it("accepts the same event with a task_event marker attached", () => {
    const result = validateEvent({ ...realEvent, task_event: "task_started" });
    expect(result.valid).toBe(true);
  });

  it.each([
    ["not an object", "just a string"],
    ["null", null],
    ["missing robot_id", { ...realEvent, robot_id: undefined }],
    ["non-numeric t", { ...realEvent, t: "zero" }],
    ["non-finite battery", { ...realEvent, battery: Number.NaN }],
    ["unrecognized status", { ...realEvent, status: "dancing" }],
    ["unrecognized task_event", { ...realEvent, task_event: "task_cancelled" }],
  ])("rejects a malformed event: %s", (_label, malformed) => {
    const result = validateEvent(malformed);
    expect(result.valid).toBe(false);
  });
});
