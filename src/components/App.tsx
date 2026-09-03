import { FleetProvider } from "../state/FleetContext";
import { Dashboard } from "./Dashboard/Dashboard";

export function App() {
  return (
    <FleetProvider>
      <Dashboard />
    </FleetProvider>
  );
}
