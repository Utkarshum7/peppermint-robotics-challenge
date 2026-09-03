// Mode container: hosts both engines (via useReplay/useLiveFeed) so
// neither loses its internal state when the user switches tabs, and
// switches which control panel is rendered based on state.mode.
//
// Mode exclusivity is enforced twice, deliberately:
//  1. UI-level: only the active mode's controls are even in the DOM, so no
//     hidden button can dispatch a stray replay/live action.
//  2. Engine-level: switching explicitly pauses/stops the OTHER engine
//     before changing state.mode, so a timer that was already running
//     can't keep firing into the new mode.

import { useFleet } from "../../state/FleetContext";
import { useReplay } from "../../hooks/useReplay";
import { useLiveFeed } from "../../hooks/useLiveFeed";
import { ReplayControls } from "./ReplayControls";
import { LiveControls } from "./LiveControls";
import "./ModeControls.css";

export function ModeControls() {
  const { state, dispatch, robotDefinitions } = useFleet();
  const replay = useReplay(dispatch, Object.values(robotDefinitions));
  const live = useLiveFeed(dispatch, () => state.robots);

  const mode = state.mode;

  function switchToReplay() {
    live.stop(); // 1. stop live, 2. its own timer is now cancelled
    dispatch({ type: "SET_MODE", mode: "replay" }); // 3. mark mode
  }

  function switchToLive() {
    replay.pause(); // 1. stop replay, 2. its own timer is now cancelled
    dispatch({ type: "SET_MODE", mode: "live" }); // 3. mark mode
  }

  function startLive() {
    // Seed from live's OWN last tick (0 right after switching into Live
    // mode, since the reducer resets it there; wherever it was left if
    // just resuming after Stop) — never from replay's clock, so a fresh
    // Live session always starts from an understandable baseline. See
    // domain/models.ts's LiveState comment for why.
    live.start(state.live.tick);
  }

  return (
    <section className="mode-controls" aria-label="Replay and live controls">
      <h2 className="mode-controls-heading">Replay / Live</h2>
      <p className="mode-controls-intro">
        Play back the recorded log, or switch to a live synthetic feed — the fleet map and
        trend chart above update from whichever source is active.
      </p>

      <div className="mode-tabs" role="tablist" aria-label="Data source">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "replay"}
          className={mode === "replay" ? "mode-tab mode-tab--active" : "mode-tab"}
          onClick={switchToReplay}
        >
          Recorded replay
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "live"}
          className={mode === "live" ? "mode-tab mode-tab--active" : "mode-tab"}
          onClick={switchToLive}
        >
          Live (synthetic)
        </button>
      </div>

      {mode === "replay" ? (
        <ReplayControls replay={replay} replayState={state.replay} dispatch={dispatch} />
      ) : (
        <LiveControls live={live} liveState={state.live} onStart={startLive} />
      )}
    </section>
  );
}
