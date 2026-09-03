// Pure decisions about WHAT the next synthetic event for one robot should
// be. No timers, no React, no fleet-state mutation, and — critically — no
// dependency on events.jsonl or anything recorded: every input here is
// either the robot's own current runtime state or a named constant from
// liveConstants.ts. Randomness is injected (`rng: () => number`, a [0,1)
// source) rather than calling Math.random() directly, so every function
// here is deterministic and testable given a fixed rng.
//
// liveGenerator.ts (the scheduler) decides WHEN this runs; this file
// decides WHAT it produces.

import type { Position, RawFleetEvent, RobotRuntimeState, RobotStatus } from "../domain/models";
import { LOW_BATTERY_THRESHOLD } from "../domain/classification";
import { MAP_HEIGHT, MAP_WIDTH } from "../domain/constants";
import {
  BATTERY_CHARGE_MAX,
  BATTERY_CHARGE_MIN,
  BATTERY_DRAIN_FAULT_MAX,
  BATTERY_DRAIN_FAULT_MIN,
  BATTERY_DRAIN_IDLE_MAX,
  BATTERY_DRAIN_IDLE_MIN,
  BATTERY_DRAIN_WORKING_MAX,
  BATTERY_DRAIN_WORKING_MIN,
  CHARGING_COMPLETE_BATTERY,
  MAX_STEP_DISTANCE,
  TARGET_REACHED_DISTANCE,
  TRANSITION_PROB,
} from "./liveConstants";

const MOVING_STATUSES: readonly RobotStatus[] = ["active", "on_mission"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomInRange(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clampToMap(position: Position): Position {
  return { x: clamp(position.x, 0, MAP_WIDTH), y: clamp(position.y, 0, MAP_HEIGHT) };
}

export function pickRandomTarget(rng: () => number): Position {
  return clampToMap({ x: rng() * MAP_WIDTH, y: rng() * MAP_HEIGHT });
}

// Moves at most MAX_STEP_DISTANCE units from `current` toward `target` —
// snaps to the target if already closer than that, never overshoots or
// teleports.
export function moveToward(current: Position, target: Position, maxStep: number): Position {
  const remaining = distance(current, target);
  if (remaining <= maxStep) return { ...target };
  const ratio = maxStep / remaining;
  return clampToMap({
    x: current.x + (target.x - current.x) * ratio,
    y: current.y + (target.y - current.y) * ratio,
  });
}

// Status transitions, checked in a fixed order: rare faults first, then a
// low-battery-triggered move toward charging, then normal lifecycle
// cycling — falling through to "no change" by default, so most ticks a
// robot's status stays exactly where it was (not purely random every tick).
export function nextStatus(status: RobotStatus, battery: number, rng: () => number): RobotStatus {
  switch (status) {
    case "idle": {
      if (rng() < TRANSITION_PROB.idleToMaintenance) return "maintenance";
      if (rng() < TRANSITION_PROB.idleToOffline) return "offline";
      if (rng() < TRANSITION_PROB.idleToActive) return "active";
      return "idle";
    }
    case "active":
    case "on_mission": {
      if (rng() < TRANSITION_PROB.workingToBlocked) return "blocked";
      if (rng() < TRANSITION_PROB.workingToError) return "error";

      const chargingProbability =
        battery < LOW_BATTERY_THRESHOLD
          ? TRANSITION_PROB.workingToChargingLowBattery
          : TRANSITION_PROB.workingToChargingNormal;
      if (rng() < chargingProbability) return "charging";

      if (status === "active") {
        if (rng() < TRANSITION_PROB.activeToOnMission) return "on_mission";
        if (rng() < TRANSITION_PROB.activeToIdle) return "idle";
        return "active";
      }
      if (rng() < TRANSITION_PROB.onMissionToIdle) return "idle";
      if (rng() < TRANSITION_PROB.onMissionToActive) return "active";
      return "on_mission";
    }
    case "charging": {
      if (battery >= CHARGING_COMPLETE_BATTERY && rng() < TRANSITION_PROB.chargingRecoverWhenFull) {
        return "idle";
      }
      return "charging";
    }
    case "blocked":
      return rng() < TRANSITION_PROB.blockedRecover ? "idle" : "blocked";
    case "error":
      return rng() < TRANSITION_PROB.errorRecover ? "idle" : "error";
    case "maintenance":
      return rng() < TRANSITION_PROB.maintenanceRecover ? "idle" : "maintenance";
    case "offline":
      return rng() < TRANSITION_PROB.offlineRecover ? "idle" : "offline";
  }
}

// Battery change, based on the ALREADY-DETERMINED next status (a robot that
// just transitioned into charging this tick starts gaining charge this same
// tick, rather than draining once more under its old status's rule).
export function nextBattery(status: RobotStatus, battery: number, rng: () => number): number {
  let next = battery;
  switch (status) {
    case "active":
    case "on_mission":
      next -= randomInRange(BATTERY_DRAIN_WORKING_MIN, BATTERY_DRAIN_WORKING_MAX, rng);
      break;
    case "charging":
      next += randomInRange(BATTERY_CHARGE_MIN, BATTERY_CHARGE_MAX, rng);
      break;
    case "blocked":
    case "error":
      next -= randomInRange(BATTERY_DRAIN_FAULT_MIN, BATTERY_DRAIN_FAULT_MAX, rng);
      break;
    case "idle":
      next -= randomInRange(BATTERY_DRAIN_IDLE_MIN, BATTERY_DRAIN_IDLE_MAX, rng);
      break;
    case "maintenance":
    case "offline":
      // Powered down / being serviced — no physical charger is modeled
      // here, so claiming battery recovers on its own would be dishonest.
      // It just holds steady.
      break;
  }
  return clamp(next, 0, 100);
}

export interface RobotSimulationResult {
  rawEvent: RawFleetEvent;
  nextTarget: Position | null;
}

// Combines the above into one generated event for one robot. `currentTarget`
// is threaded through by the caller (liveGenerator.ts owns the per-robot
// target map) — this function itself has no memory between calls.
export function simulateRobotStep(
  robot: RobotRuntimeState,
  currentTarget: Position | null,
  t: number,
  rng: () => number,
): RobotSimulationResult {
  const status = nextStatus(robot.status, robot.battery, rng);
  const battery = nextBattery(status, robot.battery, rng);

  let position = robot.position;
  let nextTarget = currentTarget;

  if (MOVING_STATUSES.includes(status)) {
    if (!nextTarget || distance(robot.position, nextTarget) <= TARGET_REACHED_DISTANCE) {
      nextTarget = pickRandomTarget(rng);
    }
    position = moveToward(robot.position, nextTarget, MAX_STEP_DISTANCE);
  }

  return {
    rawEvent: {
      t,
      robot_id: robot.robotId,
      x: position.x,
      y: position.y,
      status,
      battery,
    },
    nextTarget,
  };
}
