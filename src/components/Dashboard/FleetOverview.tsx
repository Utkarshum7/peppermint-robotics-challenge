// Displays derived metrics only — all the actual math lives in
// domain/fleetMetrics.ts (computeFleetMetrics), which itself reads
// domain/classification.ts. Nothing here re-checks robot.status or
// re-implements "working"/"needs attention".

import { useFleet } from "../../state/FleetContext";
import { computeFleetMetrics } from "../../domain/fleetMetrics";
import "./FleetOverview.css";

export function FleetOverview() {
  const { state } = useFleet();
  const metrics = computeFleetMetrics(state.robots);

  return (
    <section className="fleet-overview" aria-label="Fleet overview">
      <div className="fleet-overview-metric">
        <span className="fleet-overview-value">{metrics.totalRobots}</span>
        <span className="fleet-overview-label">Total robots</span>
      </div>
      <div className="fleet-overview-metric">
        <span className="fleet-overview-value">{metrics.workingCount}</span>
        <span className="fleet-overview-label">Working</span>
      </div>
      <div className="fleet-overview-metric fleet-overview-metric--attention">
        <span className="fleet-overview-value">{metrics.attentionCount}</span>
        <span className="fleet-overview-label">Needs attention</span>
      </div>
      <div className="fleet-overview-metric">
        <span className="fleet-overview-value">{metrics.averageBattery.toFixed(1)}%</span>
        <span className="fleet-overview-label">Avg battery</span>
      </div>
    </section>
  );
}
