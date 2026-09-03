// Owns live-generation timing and the start/stop state machine. Mirrors
// replay/replayEngine.ts's shape deliberately: one pending timer handle,
// created only in scheduleNext(), cancelled only in stop() — but there is
// no cursor/groups/completion here, since live has no fixed endpoint.
//
// Independence from the recorded log is structural, not just behavioral:
// this file has no import of data/events.ts, replay/*, or events.jsonl
// anywhere — the only way it knows about robots at all is the
// getCurrentRobots() callback supplied by its caller (hooks/useLiveFeed.ts),
// which reads live FleetState, never the recorded file.
//
// Like ReplayEngine, this class never touches FleetState or applyEvent
// itself — it only calls back with newly generated RawFleetEvents; the
// existing shared pipeline (domain/processIncomingEvent.ts) and reducer
// decide what happens to them.

import type { Position, RawFleetEvent, RobotRuntimeState } from "../domain/models";
import { simulateRobotStep } from "./liveSimulation";
import { LIVE_TICK_INTERVAL_MS, LIVE_TICK_STEP_SECONDS, UPDATE_PROBABILITY_PER_TICK } from "./liveConstants";

export type LiveStatus = "idle" | "running";

export interface LiveGeneratorCallbacks {
  getCurrentRobots: () => Record<string, RobotRuntimeState>;
  onGenerateEvents: (events: RawFleetEvent[], tick: number) => void;
  onStatusChange: (status: LiveStatus) => void;
}

export class LiveGenerator {
  private readonly callbacks: LiveGeneratorCallbacks;
  private readonly rng: () => number;
  private readonly targets = new Map<string, Position>();
  private tick = 0;
  private status: LiveStatus = "idle";
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: LiveGeneratorCallbacks, rng: () => number = Math.random) {
    this.callbacks = callbacks;
    this.rng = rng;
  }

  // seedTick lets the caller continue the synthetic "t" from wherever
  // replay's own display currently sits (0 if replay never ran), so
  // "last updated" timestamps read as moving forward across a mode switch
  // rather than jumping backward.
  start(seedTick: number): void {
    if (this.status === "running") return;
    this.tick = seedTick;
    this.status = "running";
    this.callbacks.onStatusChange("running");
    this.scheduleNext();
  }

  stop(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    if (this.status !== "idle") {
      this.status = "idle";
      this.callbacks.onStatusChange("idle");
    }
  }

  private scheduleNext(): void {
    this.timeoutHandle = setTimeout(() => {
      this.timeoutHandle = null;
      this.generateTick();
      if (this.status === "running") this.scheduleNext();
    }, LIVE_TICK_INTERVAL_MS);
  }

  private generateTick(): void {
    this.tick += LIVE_TICK_STEP_SECONDS;
    const currentRobots = this.callbacks.getCurrentRobots();
    const events: RawFleetEvent[] = [];

    for (const robotId of Object.keys(currentRobots)) {
      // Not every robot updates every tick — keeps robots from moving in
      // lockstep.
      if (this.rng() > UPDATE_PROBABILITY_PER_TICK) continue;

      const robot = currentRobots[robotId];
      const target = this.targets.get(robotId) ?? null;
      const result = simulateRobotStep(robot, target, this.tick, this.rng);

      if (result.nextTarget) {
        this.targets.set(robotId, result.nextTarget);
      }
      events.push(result.rawEvent);
    }

    if (events.length > 0) {
      this.callbacks.onGenerateEvents(events, this.tick);
    }
  }
}
