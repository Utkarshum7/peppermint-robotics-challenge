// Owns replay timing and the play/pause/reset/completion state machine.
// Deliberately does NOT know about FleetState, applyEvent, or dispatch — it
// only calls back with which TimestampGroup is due, via callbacks supplied
// by its caller (hooks/useReplay.ts). That's the whole boundary: this file
// decides WHEN; the existing shared pipeline + reducer decide WHAT HAPPENS.
//
// Timer discipline: exactly one pending setTimeout handle at a time
// (`timeoutHandle`), created only in scheduleNext(), cancelled only in
// clearTimer() — called from pause() and reset(). play() is a no-op while
// already playing or completed, so repeated clicks can't create a second
// chain.

import type { TimestampGroup } from "./timestampGroups";

export type ReplayStatus = "idle" | "playing" | "paused" | "completed";

// (nextT - currentT) recorded seconds, converted to real milliseconds at
// the given speed multiplier. E.g. a 5s recorded gap is 5000ms at 1x,
// 1000ms at 5x, 500ms at 10x.
export function computeDelayMs(currentT: number, nextT: number, speedMultiplier: number): number {
  return ((nextT - currentT) * 1000) / speedMultiplier;
}

export interface ReplayEngineCallbacks {
  onApplyGroup: (group: TimestampGroup, tickIndex: number) => void;
  onStatusChange: (status: ReplayStatus) => void;
  onReset: () => void;
}

export class ReplayEngine {
  private readonly groups: TimestampGroup[];
  private readonly callbacks: ReplayEngineCallbacks;
  private speed: number;
  private cursor = 0; // index of the next group NOT yet applied
  private status: ReplayStatus = "idle";
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(groups: TimestampGroup[], callbacks: ReplayEngineCallbacks, initialSpeed = 1) {
    this.groups = groups;
    this.callbacks = callbacks;
    this.speed = initialSpeed;
  }

  // Play immediately applies the first recorded moment (avoids an
  // unnecessary wait before anything happens), then schedules every
  // subsequent group off the recorded timestamps. Resuming from pause just
  // re-arms the schedule for the group already waiting at the cursor — it
  // does not re-apply anything.
  play(): void {
    if (this.status === "playing" || this.status === "completed") return;
    if (this.groups.length === 0) return;

    if (this.cursor === 0) {
      this.applyCurrentGroup();
      if (this.isFinished()) return;
    }

    this.setStatus("playing");
    this.scheduleNext();
  }

  pause(): void {
    if (this.status !== "playing") return;
    this.clearTimer();
    this.setStatus("paused");
  }

  reset(): void {
    this.clearTimer();
    this.cursor = 0;
    this.status = "idle";
    this.callbacks.onReset();
  }

  // Takes effect starting from the NEXT scheduled group — the currently
  // pending wait, if any, is not cancelled/rescheduled early. Simpler and
  // deterministic; media-player-precision resume isn't required here.
  setSpeed(speed: number): void {
    this.speed = speed;
  }

  private applyCurrentGroup(): void {
    const group = this.groups[this.cursor];
    this.callbacks.onApplyGroup(group, this.cursor);
    this.cursor++;
  }

  private isFinished(): boolean {
    if (this.cursor >= this.groups.length) {
      this.clearTimer();
      this.setStatus("completed");
      return true;
    }
    return false;
  }

  private scheduleNext(): void {
    const previousT = this.groups[this.cursor - 1].t;
    const nextT = this.groups[this.cursor].t;
    const delay = computeDelayMs(previousT, nextT, this.speed);

    this.timeoutHandle = setTimeout(() => {
      this.timeoutHandle = null;
      this.applyCurrentGroup();
      if (this.isFinished()) return;
      this.scheduleNext();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  private setStatus(status: ReplayStatus): void {
    this.status = status;
    this.callbacks.onStatusChange(status);
  }
}
