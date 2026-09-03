// Compact, presentational only — receives a fully-derived view of one robot
// and renders it. No classification logic here: tier/label/glyph all come
// from statusPresentation.ts, which itself reads domain/classification.ts.
//
// A native <button> (not a styled <div>) so the marker is keyboard-reachable
// and has a real accessible name — status/type/attention are communicated
// through label text, a glyph, and shape, not color alone.

import type { RobotRuntimeState, RobotType } from "../../domain/models";
import { getAttentionReason, getStatusPresentation } from "../statusPresentation";
import "./RobotMarker.css";

interface RobotMarkerProps {
  robot: RobotRuntimeState;
  robotType: RobotType;
  leftPercent: number;
  topPercent: number;
  isSelected: boolean;
  onSelect: (robotId: string) => void;
}

export function RobotMarker({
  robot,
  robotType,
  leftPercent,
  topPercent,
  isSelected,
  onSelect,
}: RobotMarkerProps) {
  const presentation = getStatusPresentation(robot.status);
  const attentionReason = getAttentionReason(robot);
  const shortId = robot.robotId.replace(/^r/, "");

  const accessibleLabel =
    `${robot.robotId}, ${robotType}, ${presentation.label}, ${Math.round(robot.battery)}% battery` +
    (attentionReason ? `, needs attention: ${attentionReason}` : "");

  const className = [
    "robot-marker",
    `robot-marker--${robotType}`,
    `robot-marker--${presentation.tier}`,
    isSelected ? "robot-marker--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
      onClick={() => onSelect(robot.robotId)}
      aria-pressed={isSelected}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <span className="robot-marker-id">{shortId}</span>
      <span className="robot-marker-glyph" aria-hidden="true">
        {presentation.glyph}
      </span>
      {attentionReason && (
        <span className="robot-marker-attention-badge" aria-hidden="true">
          !
        </span>
      )}
    </button>
  );
}
