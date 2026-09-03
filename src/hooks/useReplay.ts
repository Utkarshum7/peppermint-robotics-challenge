// Thin React binding over ReplayEngine. Loads events.jsonl once, groups it,
// creates exactly one ReplayEngine (held in a ref so it survives
// re-renders), and wires its callbacks to dispatch. This hook holds no
// fleet-state logic itself — every state change still goes through
// toFleetEvent (validate+normalize) and the existing reducer.

import { useEffect, useRef, useState, type Dispatch } from "react";
import type { FleetAction } from "../state/fleetReducer";
import type { RobotDefinition } from "../domain/models";
import { loadRecordedEvents } from "../data/events";
import { toFleetEvent } from "../domain/processIncomingEvent";
import { groupEventsByTimestamp, type TimestampGroup } from "../replay/timestampGroups";
import { ReplayEngine, type ReplayStatus } from "../replay/replayEngine";

export const REPLAY_SPEED_OPTIONS = [1, 2, 5, 10] as const;

export interface UseReplayResult {
  isLoading: boolean;
  loadError: string | null;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
}

export function useReplay(
  dispatch: Dispatch<FleetAction>,
  robotDefinitions: RobotDefinition[],
): UseReplayResult {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const engineRef = useRef<ReplayEngine | null>(null);

  // Kept fresh on every render so the engine's onReset callback (created
  // once, inside the effect below) never closes over a stale roster —
  // without this, RESET_REPLAY would always reset to whatever
  // robotDefinitions happened to be on the first render.
  const robotDefinitionsRef = useRef(robotDefinitions);
  robotDefinitionsRef.current = robotDefinitions;

  useEffect(() => {
    let cancelled = false;

    loadRecordedEvents()
      .then((rawEvents) => {
        if (cancelled) return;

        const groups = groupEventsByTimestamp(rawEvents);

        engineRef.current = new ReplayEngine(groups, {
          onApplyGroup: (group: TimestampGroup) => {
            for (const rawEvent of group.events) {
              const result = toFleetEvent(rawEvent);
              if ("event" in result) {
                dispatch({ type: "APPLY_EVENT", event: result.event });
              }
              // A rejection here would mean a malformed line in the
              // recorded file — the real dataset is verified clean (see
              // data/events.ts), so this is a safety net, not an expected path.
            }
            dispatch({ type: "ADVANCE_REPLAY_TICK", currentTick: group.t });
          },
          onStatusChange: (status: ReplayStatus) => {
            dispatch({ type: "SET_REPLAY_STATUS", status });
          },
          onReset: () => {
            dispatch({ type: "RESET_REPLAY", robots: robotDefinitionsRef.current });
          },
        });

        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      // Cancels any pending timer so replay cannot continue after this
      // component unmounts — pause() is the one place the engine's timer
      // gets cleared, reused here rather than duplicated.
      engineRef.current?.pause();
    };
  }, [dispatch]);

  return {
    isLoading,
    loadError,
    play: () => engineRef.current?.play(),
    pause: () => engineRef.current?.pause(),
    reset: () => engineRef.current?.reset(),
    setSpeed: (speed: number) => engineRef.current?.setSpeed(speed),
  };
}
