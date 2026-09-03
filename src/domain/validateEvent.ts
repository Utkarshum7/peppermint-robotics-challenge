// Structural validation for one incoming event, before anything is trusted
// enough to normalize or apply. Takes `unknown`, not RawFleetEvent — the
// whole point is defending against data that doesn't actually match the
// type (a malformed line, or a bug in the future live generator).
//
// No schema-validation library: the dataset has exactly one event shape
// (verified directly against events.jsonl), so a handful of explicit checks
// covers it without a general-purpose framework.

import { ALL_ROBOT_STATUSES, type RawFleetEvent, type RobotStatus } from "./models";

// Same as RawFleetEvent, but with `status` narrowed to a real RobotStatus —
// lets normalizeEvent take this type directly with no unsafe cast.
export type ValidatedRawEvent = Omit<RawFleetEvent, "status"> & { status: RobotStatus };

export type ValidationResult =
  | { valid: true; event: ValidatedRawEvent }
  | { valid: false; reason: string };

function invalid(reason: string): ValidationResult {
  return { valid: false, reason };
}

function isRobotStatus(value: unknown): value is RobotStatus {
  return typeof value === "string" && (ALL_ROBOT_STATUSES as readonly string[]).includes(value);
}

export function validateEvent(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null) {
    return invalid("event is not an object");
  }

  const e = raw as Record<string, unknown>;

  if (!Number.isFinite(e.t)) {
    return invalid(`t must be a finite number, got ${JSON.stringify(e.t)}`);
  }
  if (typeof e.robot_id !== "string" || e.robot_id.length === 0) {
    return invalid(`robot_id must be a non-empty string, got ${JSON.stringify(e.robot_id)}`);
  }
  if (!Number.isFinite(e.x)) {
    return invalid(`x must be a finite number, got ${JSON.stringify(e.x)}`);
  }
  if (!Number.isFinite(e.y)) {
    return invalid(`y must be a finite number, got ${JSON.stringify(e.y)}`);
  }
  if (!Number.isFinite(e.battery)) {
    return invalid(`battery must be a finite number, got ${JSON.stringify(e.battery)}`);
  }
  if (!isRobotStatus(e.status)) {
    return invalid(`unrecognized status ${JSON.stringify(e.status)}`);
  }
  if (
    e.task_event !== undefined &&
    e.task_event !== "task_started" &&
    e.task_event !== "task_completed"
  ) {
    return invalid(`unrecognized task_event ${JSON.stringify(e.task_event)}`);
  }

  return {
    valid: true,
    event: {
      t: e.t as number,
      robot_id: e.robot_id,
      x: e.x as number,
      y: e.y as number,
      status: e.status,
      battery: e.battery as number,
      task_event: e.task_event as ValidatedRawEvent["task_event"],
    },
  };
}
