// The single pure function that folds one normalized FleetEvent into the
// fleet's robot state. Called identically by replay and the live generator —
// this is the one place "an incoming event becomes fleet state."
//
// Deterministic, no React, no timers, no network calls. Never mutates its
// input; returns a new record with only the affected robot replaced.

import type { FleetEvent, RobotRuntimeState } from "./models";

export function applyEvent(
  robots: Record<string, RobotRuntimeState>,
  event: FleetEvent,
): Record<string, RobotRuntimeState> {
  const existing = robots[event.robotId];

  // Unknown robot IDs are safely ignored, not dynamically created. The
  // fixed 8-robot roster is closed; this can only realistically happen from
  // a bug in a future event source (the live generator), so it's worth a
  // console warning during development without making the pipeline fragile.
  if (!existing) {
    console.warn(`applyEvent: unknown robot_id "${event.robotId}", event ignored`);
    return robots;
  }

  // Every event in the actual dataset carries the full telemetry payload —
  // t, position, status, and battery are never partial — so every field
  // below is always genuinely represented by the event, not defaulted or
  // inferred. task_event is deliberately NOT written to RobotRuntimeState:
  // it's metadata describing the event itself (a mission starting or
  // finishing), not a piece of the robot's own ongoing state.
  return {
    ...robots,
    [event.robotId]: {
      ...existing,
      position: event.position,
      status: event.status,
      battery: event.battery,
      lastUpdatedAt: event.t,
    },
  };
}
