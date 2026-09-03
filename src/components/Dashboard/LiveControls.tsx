// Genuine live controls — Start/Stop only, no fake media-player buttons.
// There's no speed/scrubbing concept for a source that generates
// indefinitely rather than replaying a fixed, timestamped log.

import type { UseLiveFeedResult } from "../../hooks/useLiveFeed";
import type { LiveState } from "../../domain/models";

interface LiveControlsProps {
  live: UseLiveFeedResult;
  liveState: LiveState;
  onStart: () => void;
}

function describeLiveStatus(status: LiveState["status"]): string {
  return status === "running" ? "Live — generating synthetic events" : "Not started";
}

export function LiveControls({ live, liveState, onStart }: LiveControlsProps) {
  const isRunning = liveState.status === "running";

  return (
    <>
      <div className="mode-controls-buttons">
        <button
          type="button"
          className="mode-controls-btn mode-controls-btn--primary"
          onClick={onStart}
          disabled={isRunning}
        >
          Start live
        </button>
        <button type="button" className="mode-controls-btn" onClick={live.stop} disabled={!isRunning}>
          Stop live
        </button>
      </div>

      <p className="mode-controls-progress">
        {describeLiveStatus(liveState.status)} — t = {liveState.tick}s (synthetic, not recorded)
      </p>
      <p className="mode-controls-note">
        Positions, battery, and status are generated independently each tick — not read from
        events.jsonl.
      </p>
    </>
  );
}
