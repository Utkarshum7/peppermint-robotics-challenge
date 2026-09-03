// Centralized status classification. This is the single place that defines
// what "working" and "needs attention" mean — every component and the trend
// chart read through these functions rather than checking robot.status
// themselves. Changing a threshold or which statuses count as working means
// editing this file only.

import type { RobotRuntimeState, RobotStatus } from "./models";

// Only active + on_mission count as productive work. idle and charging are
// normal operating states, not failures, so they're excluded from the
// working-percentage trend but are not attention-worthy either.
export const WORKING_STATUSES: readonly RobotStatus[] = ["active", "on_mission"];

export const OPERATIONAL_IDLE_STATUSES: readonly RobotStatus[] = ["idle", "charging"];

export const ATTENTION_STATUSES: readonly RobotStatus[] = [
  "blocked",
  "error",
  "offline",
  "maintenance",
];

// The dataset's observed battery range is ~13.1%-96.5%; it never reaches 0 or
// 100, so there's no threshold the data defines for us. 20% sits above that
// observed floor (so it actually fires against the genuinely low readings
// present in the data) and is a conventional, defensible round number —
// an explicit assumption, not derived from the dataset.
export const LOW_BATTERY_THRESHOLD = 20;

export function isWorking(robot: RobotRuntimeState): boolean {
  return WORKING_STATUSES.includes(robot.status);
}

export function isOperationalIdle(robot: RobotRuntimeState): boolean {
  return OPERATIONAL_IDLE_STATUSES.includes(robot.status);
}

export function isLowBattery(robot: RobotRuntimeState): boolean {
  return robot.battery < LOW_BATTERY_THRESHOLD;
}

// A working robot can still be low on battery — the two are independent axes,
// not mutually exclusive categories.
export function needsAttention(robot: RobotRuntimeState): boolean {
  return ATTENTION_STATUSES.includes(robot.status) || isLowBattery(robot);
}
