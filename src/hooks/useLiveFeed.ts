// Thin React binding over LiveGenerator — the live counterpart to
// hooks/useReplay.ts. No fleet-state or simulation logic lives here; it
// only wires the generator's callbacks to dispatch through the existing
// shared pipeline (toFleetEvent), exactly like replay does.

import { useEffect, useRef, type Dispatch } from "react";
import type { FleetAction } from "../state/fleetReducer";
import type { RawFleetEvent, RobotRuntimeState } from "../domain/models";
import { toFleetEvent } from "../domain/processIncomingEvent";
import { LiveGenerator, type LiveStatus } from "../live/liveGenerator";

export interface UseLiveFeedResult {
  start: (seedTick: number) => void;
  stop: () => void;
}

export function useLiveFeed(
  dispatch: Dispatch<FleetAction>,
  getCurrentRobots: () => Record<string, RobotRuntimeState>,
): UseLiveFeedResult {
  const generatorRef = useRef<LiveGenerator | null>(null);

  // Kept fresh every render so the generator (constructed once, below)
  // always reads the CURRENT fleet state when a tick fires, never a
  // snapshot from whenever the effect first ran — the same pattern
  // useReplay uses for robotDefinitionsRef.
  const getCurrentRobotsRef = useRef(getCurrentRobots);
  getCurrentRobotsRef.current = getCurrentRobots;

  useEffect(() => {
    generatorRef.current = new LiveGenerator({
      getCurrentRobots: () => getCurrentRobotsRef.current(),
      onGenerateEvents: (events: RawFleetEvent[], tick: number) => {
        for (const rawEvent of events) {
          const result = toFleetEvent(rawEvent);
          if ("event" in result) {
            dispatch({ type: "APPLY_EVENT", event: result.event });
          }
          // A rejection here would mean a bug in the generator itself
          // (see domain/validateEvent.ts) — the same safety net replay
          // has, now actually exercised by a source that isn't pre-verified
          // clean data.
        }
        dispatch({ type: "ADVANCE_LIVE_TICK", tick });
      },
      onStatusChange: (status: LiveStatus) => {
        dispatch({ type: "SET_LIVE_STATUS", status });
      },
    });

    return () => {
      // Cancels any pending timer so live generation cannot continue after
      // this component unmounts — stop() is the one place the generator's
      // timer gets cleared, reused here rather than duplicated.
      generatorRef.current?.stop();
    };
  }, [dispatch]);

  return {
    start: (seedTick: number) => generatorRef.current?.start(seedTick),
    stop: () => generatorRef.current?.stop(),
  };
}
