import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RobotRuntimeState } from "../domain/models";
import { LiveGenerator } from "../live/liveGenerator";
import { LIVE_TICK_INTERVAL_MS } from "../live/liveConstants";
import { toFleetEvent } from "../domain/processIncomingEvent";
import { applyEvent } from "../domain/applyEvent";

function fixtureRobots(): Record<string, RobotRuntimeState> {
  return {
    r1: { robotId: "r1", position: { x: 100, y: 100 }, status: "active", battery: 80, lastUpdatedAt: 0 },
    r2: { robotId: "r2", position: { x: 500, y: 200 }, status: "idle", battery: 60, lastUpdatedAt: 0 },
  };
}

describe("LiveGenerator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates nothing before the first tick interval elapses", () => {
    const onGenerateEvents = vi.fn();
    const generator = new LiveGenerator(
      { getCurrentRobots: fixtureRobots, onGenerateEvents, onStatusChange: vi.fn() },
      () => 0.5,
    );

    generator.start(0);
    vi.advanceTimersByTime(LIVE_TICK_INTERVAL_MS - 1);
    expect(onGenerateEvents).not.toHaveBeenCalled();
  });

  it("generates events on each tick interval while running", () => {
    const onGenerateEvents = vi.fn();
    const generator = new LiveGenerator(
      { getCurrentRobots: fixtureRobots, onGenerateEvents, onStatusChange: vi.fn() },
      () => 0.1, // low rng: passes the UPDATE_PROBABILITY_PER_TICK gate for every robot
    );

    generator.start(0);
    vi.advanceTimersByTime(LIVE_TICK_INTERVAL_MS);
    expect(onGenerateEvents).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(LIVE_TICK_INTERVAL_MS);
    expect(onGenerateEvents).toHaveBeenCalledTimes(2);
  });

  it("reads CURRENT fleet state on each tick, not a stale snapshot from start()", () => {
    let currentRobots = fixtureRobots();
    const onGenerateEvents = vi.fn();
    const generator = new LiveGenerator(
      { getCurrentRobots: () => currentRobots, onGenerateEvents, onStatusChange: vi.fn() },
      () => 0.1,
    );

    generator.start(0);
    vi.advanceTimersByTime(LIVE_TICK_INTERVAL_MS);
    const firstTickIds = onGenerateEvents.mock.calls[0][0].map((e: { robot_id: string }) => e.robot_id);
    expect(firstTickIds).toEqual(expect.arrayContaining(["r1", "r2"]));

    // Simulate the fleet gaining a robot between ticks (as would happen once
    // the reducer applies the previous tick's events, or after any state
    // change) — the generator must pick this up, not the roster it saw at start().
    currentRobots = { ...currentRobots, r3: { robotId: "r3", position: { x: 0, y: 0 }, status: "idle", battery: 100, lastUpdatedAt: 0 } };

    vi.advanceTimersByTime(LIVE_TICK_INTERVAL_MS);
    const secondTickIds = onGenerateEvents.mock.calls[1][0].map((e: { robot_id: string }) => e.robot_id);
    expect(secondTickIds).toContain("r3");
  });

  it("repeated start() calls while already running do not create duplicate timers", () => {
    const onGenerateEvents = vi.fn();
    const generator = new LiveGenerator(
      { getCurrentRobots: fixtureRobots, onGenerateEvents, onStatusChange: vi.fn() },
      () => 0.1,
    );

    generator.start(0);
    generator.start(0);
    generator.start(0);

    vi.advanceTimersByTime(LIVE_TICK_INTERVAL_MS);
    expect(onGenerateEvents).toHaveBeenCalledTimes(1); // not 3
  });

  it("stop() cancels the pending timer — no further events after stopping", () => {
    const onGenerateEvents = vi.fn();
    const onStatusChange = vi.fn();
    const generator = new LiveGenerator(
      { getCurrentRobots: fixtureRobots, onGenerateEvents, onStatusChange },
      () => 0.1,
    );

    generator.start(0);
    generator.stop();
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");

    vi.advanceTimersByTime(LIVE_TICK_INTERVAL_MS * 3);
    expect(onGenerateEvents).not.toHaveBeenCalled();
  });

  it("no robot ever receives an event when rng always fails the per-tick update gate", () => {
    const onGenerateEvents = vi.fn();
    const generator = new LiveGenerator(
      { getCurrentRobots: fixtureRobots, onGenerateEvents, onStatusChange: vi.fn() },
      () => 0.99, // fails UPDATE_PROBABILITY_PER_TICK (0.7) for every robot
    );

    generator.start(0);
    vi.advanceTimersByTime(LIVE_TICK_INTERVAL_MS);
    expect(onGenerateEvents).not.toHaveBeenCalled(); // nothing generated this tick
  });
});

describe("Live-generated events pass through the same shared pipeline as replay", () => {
  it("a generated event validates, normalizes, and updates the intended robot via applyEvent", () => {
    const robots = fixtureRobots();
    const generatedRawEvent = { t: 5, robot_id: "r1", x: 110, y: 105, status: "active", battery: 79 };

    const result = toFleetEvent(generatedRawEvent);
    expect("event" in result).toBe(true);
    if (!("event" in result)) return;

    const nextRobots = applyEvent(robots, result.event);
    expect(nextRobots.r1).toMatchObject({ position: { x: 110, y: 105 }, status: "active", battery: 79 });
    expect(nextRobots.r2).toBe(robots.r2); // untouched
  });
});
