// UI-only presentation for a RobotStatus: label + glyph + a visual tier for
// the compact marker. This is presentation, not business logic — the tier
// is DERIVED from domain/classification.ts's status arrays (not a second,
// hand-maintained copy of "which statuses count as working/attention"), so
// changing WORKING_STATUSES/ATTENTION_STATUSES there automatically updates
// every marker/status display without touching this file. Only the label
// text and glyph character are genuinely presentation-only choices.

import type { RobotRuntimeState, RobotStatus } from "../domain/models";
import { ATTENTION_STATUSES, WORKING_STATUSES, isLowBattery, needsAttention } from "../domain/classification";

export type StatusTier = "working" | "idle" | "attention";

interface StatusPresentation {
  label: string;
  glyph: string; // short, non-color signal for the compact marker
  tier: StatusTier;
}

const STATUS_LABELS: Record<RobotStatus, { label: string; glyph: string }> = {
  active: { label: "Active", glyph: "●" },
  on_mission: { label: "On mission", glyph: "▶" },
  idle: { label: "Idle", glyph: "○" },
  charging: { label: "Charging", glyph: "⚡" },
  blocked: { label: "Blocked", glyph: "■" },
  error: { label: "Error", glyph: "✕" },
  maintenance: { label: "Maintenance", glyph: "▲" },
  offline: { label: "Offline", glyph: "◌" },
};

function tierForStatus(status: RobotStatus): StatusTier {
  if (WORKING_STATUSES.includes(status)) return "working";
  if (ATTENTION_STATUSES.includes(status)) return "attention";
  return "idle"; // idle, charging — operational but not actively working
}

export function getStatusPresentation(status: RobotStatus): StatusPresentation {
  return { ...STATUS_LABELS[status], tier: tierForStatus(status) };
}

// A robot needing attention for its battery, not its status, still needs a
// visible signal on the marker/details even though its own status entry
// above says "working" or "idle" — this combines both without duplicating
// the needsAttention/isLowBattery rules themselves.
export function getAttentionReason(robot: RobotRuntimeState): string | null {
  if (!needsAttention(robot)) return null;
  const reasons: string[] = [];
  if (tierForStatus(robot.status) === "attention") {
    reasons.push(STATUS_LABELS[robot.status].label);
  }
  if (isLowBattery(robot)) {
    reasons.push("Low battery");
  }
  return reasons.join(" · ");
}
