// Pure filtering logic for the search/attention panel. Colocated with its
// one consumer (SearchAndFilter.tsx) rather than in domain/ — this is
// operator-workflow logic (matching a query string), not fleet business
// classification. The attention half is NOT reimplemented here: it calls
// straight into domain/classification.ts's needsAttention, the same
// function Fleet Overview and the map markers use.

import type { RobotRuntimeState } from "../../domain/models";
import { needsAttention } from "../../domain/classification";

export type AttentionFilterMode = "all" | "attention";

// Case-insensitive partial match against a robot's ID. An empty/whitespace
// query matches everything — that's what makes "no query" default to
// showing the full roster rather than an empty list.
export function matchesSearchQuery(robotId: string, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return true;
  return robotId.toLowerCase().includes(trimmed);
}

export function filterRobots(
  robots: RobotRuntimeState[],
  searchQuery: string,
  filterMode: AttentionFilterMode,
): RobotRuntimeState[] {
  return robots.filter((robot) => {
    if (filterMode === "attention" && !needsAttention(robot)) return false;
    return matchesSearchQuery(robot.robotId, searchQuery);
  });
}
