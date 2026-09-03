// Renders the replay tab's controls. Presentation only: reads the replay
// state it's handed and calls the functions on `replay`: it owns no timing
// or fleet-mutation logic itself.

import type { Dispatch } from "react";
import { REPLAY_SPEED_OPTIONS, type UseReplayResult } from "../../hooks/useReplay";
import { RECORDED_WINDOW_SECONDS } from "../../domain/constants";
import type { ReplayState } from "../../domain/models";
import type { FleetAction } from "../../state/fleetReducer";

function describeReplayStatus(status: ReplayState["status"]): string {
  switch (status) {
    case "idle":
      return "Not started";
    case "playing":
      return "Replaying";
    case "paused":
      return "Paused";
    case "completed":
      return "Replay complete";
  }
}

interface ReplayControlsProps {
  replay: UseReplayResult;
  replayState: ReplayState;
  dispatch: Dispatch<FleetAction>;
}

export function ReplayControls({ replay, replayState, dispatch }: ReplayControlsProps) {
  const { status, currentTick, speedMultiplier } = replayState;
  const isPlaying = status === "playing";
  const isCompleted = status === "completed";

  if (replay.loadError) {
    return <p className="mode-controls-error">Failed to load recorded events: {replay.loadError}</p>;
  }

  return (
    <>
      <div className="mode-controls-buttons">
        <button
          type="button"
          className="mode-controls-btn mode-controls-btn--primary"
          onClick={replay.play}
          disabled={replay.isLoading || isPlaying || isCompleted}
        >
          Play
        </button>
        <button
          type="button"
          className="mode-controls-btn"
          onClick={replay.pause}
          disabled={replay.isLoading || !isPlaying}
        >
          Pause
        </button>
        <button type="button" className="mode-controls-btn" onClick={replay.reset} disabled={replay.isLoading}>
          Reset
        </button>
      </div>

      <div className="mode-controls-speed" role="group" aria-label="Playback speed">
        <span className="mode-controls-speed-label">Speed:</span>
        {REPLAY_SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={
              speed === speedMultiplier
                ? "mode-controls-speed-btn mode-controls-speed-btn--active"
                : "mode-controls-speed-btn"
            }
            aria-pressed={speed === speedMultiplier}
            disabled={replay.isLoading}
            onClick={() => {
              dispatch({ type: "SET_REPLAY_SPEED", speedMultiplier: speed });
              replay.setSpeed(speed);
            }}
          >
            {speed}x
          </button>
        ))}
      </div>

      <p className="mode-controls-progress">
        {replay.isLoading
          ? "Loading recorded events…"
          : `${describeReplayStatus(status)} — t = ${currentTick}s / ${RECORDED_WINDOW_SECONDS}s`}
      </p>
    </>
  );
}
