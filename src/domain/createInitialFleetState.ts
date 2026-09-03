// Pure transformation: RobotDefinition[] (static, from robots.json) ->
// initial Record<robotId, RobotRuntimeState>.
//
// robots.json carries no battery/status, only a starting position, so this
// function assigns a sensible pre-event baseline (idle, full battery) rather
// than inventing values. Once replay/live starts, the first real event for
// each robot overwrites this via applyEvent.
//
// No React here — this is reused both for the app's first load and for
// RESET_REPLAY, which needs to return the fleet to this exact baseline.

import type { RobotDefinition, RobotRuntimeState } from "./models";

const BASELINE_STATUS = "idle" as const;
const BASELINE_BATTERY = 100;

export function createInitialFleetState(
  robots: RobotDefinition[],
): Record<string, RobotRuntimeState> {
  const state: Record<string, RobotRuntimeState> = {};

  for (const robot of robots) {
    state[robot.robotId] = {
      robotId: robot.robotId,
      position: { x: robot.start.x, y: robot.start.y },
      status: BASELINE_STATUS,
      battery: BASELINE_BATTERY,
      lastUpdatedAt: 0,
    };
  }

  return state;
}
