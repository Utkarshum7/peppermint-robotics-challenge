// Every tunable number the live simulation uses, in one place — nothing in
// liveSimulation.ts or liveGenerator.ts should have an inline magic number.
// These are conservative, hand-picked values for a plausible dashboard demo,
// not a physically modeled robot fleet.

// --- Scheduling ---
// Wall-clock time between generation ticks. Roughly comparable to the
// recorded log's own 5s cadence, without being tied to it.
export const LIVE_TICK_INTERVAL_MS = 4000;
// How far the synthetic "t" advances per tick — matches the recorded data's
// own step size so "t = Ns" reads consistently whichever source produced it.
export const LIVE_TICK_STEP_SECONDS = 5;
// Chance any given robot receives a generated event on a given tick. Below
// 1 so robots don't all move/update in lockstep every single tick.
export const UPDATE_PROBABILITY_PER_TICK = 0.7;

// --- Movement ---
// Max distance (map units) a working robot moves toward its target in one
// tick — keeps movement incremental, never a teleport.
export const MAX_STEP_DISTANCE = 25;
// Once within this distance of its target, a robot picks a new one.
export const TARGET_REACHED_DISTANCE = 15;

// --- Battery ---
export const BATTERY_DRAIN_WORKING_MIN = 0.2;
export const BATTERY_DRAIN_WORKING_MAX = 0.9;
// blocked/error: still powered and stuck, so battery still drains, just
// slower than active work.
export const BATTERY_DRAIN_FAULT_MIN = 0.05;
export const BATTERY_DRAIN_FAULT_MAX = 0.2;
export const BATTERY_DRAIN_IDLE_MIN = 0;
export const BATTERY_DRAIN_IDLE_MAX = 0.1;
export const BATTERY_CHARGE_MIN = 2.0;
export const BATTERY_CHARGE_MAX = 4.0;
// Above this, a charging robot has a real chance of being "done" each tick.
export const CHARGING_COMPLETE_BATTERY = 90;

// --- Status transition probabilities (checked per tick, per robot) ---
//
// Fault-entry probabilities are kept low and recovery probabilities
// (especially maintenance/offline) are kept relatively high, so that
// attention states (blocked/error/maintenance/offline) stay a genuinely
// uncommon, occasional occurrence over a multi-minute live session rather
// than several robots accumulating into a stuck state at once — a dashboard
// operator should mostly see a healthy fleet with occasional real issues to
// investigate, not a fleet that degrades into mostly-broken over time.
export const TRANSITION_PROB = {
  idleToActive: 0.15,
  activeToOnMission: 0.1,
  activeToIdle: 0.1,
  onMissionToIdle: 0.1,
  onMissionToActive: 0.05,
  workingToBlocked: 0.008,
  workingToError: 0.006,
  workingToChargingLowBattery: 0.4,
  workingToChargingNormal: 0.01,
  idleToMaintenance: 0.0015,
  idleToOffline: 0.0015,
  blockedRecover: 0.25,
  errorRecover: 0.15,
  maintenanceRecover: 0.08,
  offlineRecover: 0.08,
  chargingRecoverWhenFull: 0.5,
} as const;
