// The shared pipeline. This is the answer to "where does an incoming event
// become fleet state":
//
//   raw event -> validateEvent -> normalizeEvent -> applyEvent -> next robots
//
// Two exports, both pure, no React/timers/network:
//
// - toFleetEvent: validate + normalize only. This is what a future replay
//   or live source calls to turn a raw event into something dispatchable —
//   it does NOT apply the event, so it never touches fleet state itself.
//   The reducer's APPLY_EVENT case (state/fleetReducer.ts) is what actually
//   calls applyEvent, against the live FleetState.
//
// - processIncomingEvent: the full pipeline in one call (validate ->
//   normalize -> apply), for use outside React — tests, and any one-off
//   verification against real loaded data. Malformed events never reach
//   applyEvent; they're rejected here and the caller gets a reason instead
//   of a crash.

import type { FleetEvent, RobotRuntimeState } from "./models";
import { validateEvent } from "./validateEvent";
import { normalizeEvent } from "./normalizeEvent";
import { applyEvent } from "./applyEvent";

export type ToFleetEventResult = { event: FleetEvent } | { rejected: string };

export function toFleetEvent(raw: unknown): ToFleetEventResult {
  const validation = validateEvent(raw);
  if (!validation.valid) {
    return { rejected: validation.reason };
  }
  return { event: normalizeEvent(validation.event) };
}

export interface ProcessIncomingEventResult {
  robots: Record<string, RobotRuntimeState>;
  event: FleetEvent | null;
  rejected?: string;
}

export function processIncomingEvent(
  raw: unknown,
  robots: Record<string, RobotRuntimeState>,
): ProcessIncomingEventResult {
  const result = toFleetEvent(raw);

  if ("rejected" in result) {
    return { robots, event: null, rejected: result.rejected };
  }

  return { robots: applyEvent(robots, result.event), event: result.event };
}
