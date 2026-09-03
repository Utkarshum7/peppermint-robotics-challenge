// Converts an already-validated raw event into the internal FleetEvent
// shape. Pure reshaping only: snake_case -> camelCase, flat x/y -> Position.
// No sorting, no timestamp changes, no fabricated fields — every field the
// dataset provides is always present (verified directly against
// events.jsonl), so there's nothing to fabricate.

import type { FleetEvent } from "./models";
import type { ValidatedRawEvent } from "./validateEvent";

export function normalizeEvent(raw: ValidatedRawEvent): FleetEvent {
  return {
    t: raw.t,
    robotId: raw.robot_id,
    position: { x: raw.x, y: raw.y },
    status: raw.status,
    battery: raw.battery,
    taskEvent: raw.task_event,
  };
}
