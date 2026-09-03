// Presentation only: reads the selected robot's current runtime state
// (looked up from state.robots by selectedRobotId — never a separate copy)
// plus its static type (from robotDefinitions), and renders what's there.
// No fabricated fields, no task history — only what the domain model
// actually carries.

import { useFleet } from "../../state/FleetContext";
import { getAttentionReason, getStatusPresentation } from "../statusPresentation";
import "./RobotDetailsPanel.css";

export function RobotDetailsPanel() {
  const { state, dispatch, robotDefinitions } = useFleet();
  const { selectedRobotId } = state;

  if (!selectedRobotId) {
    return (
      <section className="robot-details-panel" aria-label="Robot details">
        <h2 className="robot-details-heading">Robot Details</h2>
        <p className="robot-details-empty">Select a robot on the map to view details.</p>
      </section>
    );
  }

  const robot = state.robots[selectedRobotId];
  const definition = robotDefinitions[selectedRobotId];

  // The roster is fixed at 8 robots for the life of the app, so this
  // shouldn't happen — but selectedRobotId is separate state from
  // state.robots, so it's not structurally guaranteed to always point at
  // something that still exists. Stay honest rather than crash.
  if (!robot || !definition) {
    return (
      <section className="robot-details-panel" aria-label="Robot details">
        <h2 className="robot-details-heading">Robot Details</h2>
        <p className="robot-details-empty">Selected robot is no longer available.</p>
      </section>
    );
  }

  const presentation = getStatusPresentation(robot.status);
  const attentionReason = getAttentionReason(robot);

  return (
    <section className="robot-details-panel" aria-label="Robot details">
      <div className="robot-details-header">
        <h2 className="robot-details-heading">{robot.robotId}</h2>
        <button
          type="button"
          className="robot-details-clear"
          onClick={() => dispatch({ type: "SELECT_ROBOT", robotId: null })}
        >
          Clear
        </button>
      </div>

      {attentionReason && (
        <p className="robot-details-attention" role="status">
          ⚠ Needs attention: {attentionReason}
        </p>
      )}

      <dl className="robot-details-list">
        <dt>Type</dt>
        <dd>{definition.robotType}</dd>

        <dt>Status</dt>
        <dd>
          {presentation.glyph} {presentation.label}
        </dd>

        <dt>Battery</dt>
        <dd>{robot.battery.toFixed(1)}%</dd>

        <dt>Position</dt>
        <dd>
          x: {robot.position.x.toFixed(1)}, y: {robot.position.y.toFixed(1)}
        </dd>

        <dt>Last updated</dt>
        <dd>t = {robot.lastUpdatedAt}s</dd>
      </dl>
    </section>
  );
}
