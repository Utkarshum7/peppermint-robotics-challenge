import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimestampGroup } from "../replay/timestampGroups";
import { ReplayEngine, computeDelayMs } from "../replay/replayEngine";

// Three recorded moments, 5 seconds apart — same shape as the real dataset
// (t steps of 5), just fewer groups so tests stay readable.
function makeGroups(): TimestampGroup[] {
  return [
    { t: 0, events: [{ t: 0, robot_id: "r1", x: 0, y: 0, status: "idle", battery: 100 }] },
    { t: 5, events: [{ t: 5, robot_id: "r1", x: 1, y: 1, status: "active", battery: 99 }] },
    { t: 10, events: [{ t: 10, robot_id: "r1", x: 2, y: 2, status: "active", battery: 98 }] },
  ];
}

describe("computeDelayMs", () => {
  it("converts a 5 recorded-second gap to real milliseconds at various speeds", () => {
    expect(computeDelayMs(0, 5, 1)).toBe(5000);
    expect(computeDelayMs(0, 5, 5)).toBe(1000);
    expect(computeDelayMs(0, 5, 10)).toBe(500);
  });
});

describe("ReplayEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies the first group immediately on Play, then schedules the rest by recorded delay", () => {
    const onApplyGroup = vi.fn();
    const onStatusChange = vi.fn();
    const engine = new ReplayEngine(makeGroups(), { onApplyGroup, onStatusChange, onReset: vi.fn() });

    engine.play();
    expect(onApplyGroup).toHaveBeenCalledTimes(1); // t=0 applied synchronously
    expect(onApplyGroup.mock.calls[0][0].t).toBe(0);
    expect(onStatusChange).toHaveBeenCalledWith("playing");

    vi.advanceTimersByTime(5000); // 1x speed, 5 recorded seconds
    expect(onApplyGroup).toHaveBeenCalledTimes(2);
    expect(onApplyGroup.mock.calls[1][0].t).toBe(5);
  });

  it("does not apply the next group before its scheduled delay has elapsed", () => {
    const onApplyGroup = vi.fn();
    const engine = new ReplayEngine(makeGroups(), { onApplyGroup, onStatusChange: vi.fn(), onReset: vi.fn() });

    engine.play();
    vi.advanceTimersByTime(4999);
    expect(onApplyGroup).toHaveBeenCalledTimes(1); // still just the immediate first group
  });

  it("pause stops further progression and leaves the cursor where it was", () => {
    const onApplyGroup = vi.fn();
    const onStatusChange = vi.fn();
    const engine = new ReplayEngine(makeGroups(), { onApplyGroup, onStatusChange, onReset: vi.fn() });

    engine.play();
    engine.pause();
    expect(onStatusChange).toHaveBeenLastCalledWith("paused");

    vi.advanceTimersByTime(10_000); // well past when t=5 would have fired
    expect(onApplyGroup).toHaveBeenCalledTimes(1); // nothing new applied while paused
  });

  it("resuming after pause continues from the next group, not from the start", () => {
    const onApplyGroup = vi.fn();
    const engine = new ReplayEngine(makeGroups(), { onApplyGroup, onStatusChange: vi.fn(), onReset: vi.fn() });

    engine.play(); // applies t=0
    engine.pause();
    engine.play(); // resume — should NOT re-apply t=0
    expect(onApplyGroup).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    expect(onApplyGroup).toHaveBeenCalledTimes(2);
    expect(onApplyGroup.mock.calls[1][0].t).toBe(5);
  });

  it("repeated Play clicks while already playing do not create duplicate timers", () => {
    const onApplyGroup = vi.fn();
    const engine = new ReplayEngine(makeGroups(), { onApplyGroup, onStatusChange: vi.fn(), onReset: vi.fn() });

    engine.play();
    engine.play(); // no-op — already playing
    engine.play();

    vi.advanceTimersByTime(5000);
    // If a duplicate timer chain existed, t=5 would have been applied more
    // than once by now.
    const t5Applications = onApplyGroup.mock.calls.filter(([group]) => group.t === 5);
    expect(t5Applications).toHaveLength(1);
  });

  it("a faster speed shortens the wait for the next group", () => {
    const onApplyGroup = vi.fn();
    const engine = new ReplayEngine(makeGroups(), { onApplyGroup, onStatusChange: vi.fn(), onReset: vi.fn() }, 5);

    engine.play();
    vi.advanceTimersByTime(1000); // 5 recorded seconds at 5x = 1000ms
    expect(onApplyGroup).toHaveBeenCalledTimes(2);
  });

  it("reaches completion after the last group, and stops without looping", () => {
    const onApplyGroup = vi.fn();
    const onStatusChange = vi.fn();
    const engine = new ReplayEngine(makeGroups(), { onApplyGroup, onStatusChange, onReset: vi.fn() });

    engine.play();
    vi.advanceTimersByTime(5000); // t=5
    vi.advanceTimersByTime(5000); // t=10 — last group

    expect(onApplyGroup).toHaveBeenCalledTimes(3);
    expect(onStatusChange).toHaveBeenLastCalledWith("completed");

    vi.advanceTimersByTime(50_000); // nothing left to fire, no loop
    expect(onApplyGroup).toHaveBeenCalledTimes(3);
  });

  it("reset cancels any pending timer, rewinds the cursor, and calls onReset", () => {
    const onApplyGroup = vi.fn();
    const onReset = vi.fn();
    const engine = new ReplayEngine(makeGroups(), { onApplyGroup, onStatusChange: vi.fn(), onReset });

    engine.play(); // applies t=0, schedules t=5
    engine.reset();
    expect(onReset).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000); // the cancelled t=5 timer must not fire
    expect(onApplyGroup).toHaveBeenCalledTimes(1); // only the original t=0 application

    // Play again after reset starts over from t=0.
    engine.play();
    expect(onApplyGroup).toHaveBeenCalledTimes(2);
    expect(onApplyGroup.mock.calls[1][0].t).toBe(0);
  });
});
