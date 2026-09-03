// Layout shell only — composes the named sections and holds no logic of its
// own. Each section reads FleetContext directly; nothing is threaded through
// Dashboard's own props/state.

import { useFleet } from "../../state/FleetContext";
import { FleetOverview } from "./FleetOverview";
import { ModeControls } from "./ModeControls";
import { FleetMap } from "../Map/FleetMap";
import { RobotDetailsPanel } from "../RobotDetails/RobotDetailsPanel";
import { SearchAndFilter } from "../Search/SearchAndFilter";
import { FleetTrendChart } from "../Trend/FleetTrendChart";
import "./Dashboard.css";

export function Dashboard() {
  const { isLoading, loadError } = useFleet();

  if (loadError) {
    return (
      <div className="dashboard-error">
        Failed to load fleet data: {loadError}
      </div>
    );
  }

  if (isLoading) {
    return <div className="dashboard-loading">Loading fleet…</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Peppermint Fleet Dashboard</h1>
      </header>

      <FleetOverview />

      <div className="dashboard-main-row">
        <FleetMap />
        <div className="dashboard-sidebar">
          <SearchAndFilter />
          <RobotDetailsPanel />
        </div>
      </div>

      <div className="dashboard-controls-row">
        <ModeControls />
      </div>

      <FleetTrendChart />
    </div>
  );
}
