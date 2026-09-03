// Fleet-level derived metrics for the overview strip. Pure, and deliberately
// not stored anywhere — computed fresh from the current robots record every
// time, so there is no second copy of "how many robots are working" that
// could drift from the actual robot state. Consumes classification.ts rather
// than re-checking robot.status itself.

import type { FleetHistoryPoint, RobotRuntimeState } from "./models";
import { isWorking, needsAttention } from "./classification";

export interface FleetMetrics {
  totalRobots: number;
  workingCount: number;
  attentionCount: number;
  averageBattery: number;
}

export function computeFleetMetrics(
  robots: Record<string, RobotRuntimeState>,
): FleetMetrics {
  const robotList = Object.values(robots);
  const totalRobots = robotList.length;

  if (totalRobots === 0) {
    return { totalRobots: 0, workingCount: 0, attentionCount: 0, averageBattery: 0 };
  }

  let workingCount = 0;
  let attentionCount = 0;
  let batterySum = 0;

  for (const robot of robotList) {
    if (isWorking(robot)) workingCount++;
    if (needsAttention(robot)) attentionCount++;
    batterySum += robot.battery;
  }

  return {
    totalRobots,
    workingCount,
    attentionCount,
    averageBattery: batterySum / totalRobots,
  };
}

// The one function that produces a fleet trend history point — built
// entirely on computeFleetMetrics above, so the trend chart's
// "working" definition can never drift from Fleet Overview's. `t` is
// supplied by the caller (the recorded tick's timestamp during replay, or
// the live generator's synthetic elapsed seconds during live mode) — this
// function only turns "current robots at some moment" into "one point,"
// it has no opinion on which clock that moment came from.
export function deriveFleetHistoryPoint(
  robots: Record<string, RobotRuntimeState>,
  t: number,
): FleetHistoryPoint {
  const metrics = computeFleetMetrics(robots);
  const workingPercentage =
    metrics.totalRobots === 0 ? 0 : (metrics.workingCount / metrics.totalRobots) * 100;

  return { t, workingPercentage, attentionCount: metrics.attentionCount };
}
