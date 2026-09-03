// Wires the fleet reducer to the component tree. FleetProvider owns the one
// FleetState instance for the whole app; components read it via useFleet()
// and dispatch actions, they never construct or hold their own copy.
//
// Loading state (isLoading/loadError) is deliberately kept local to this
// component rather than in FleetState — it describes "are we still fetching
// robots.json", not fleet data itself.

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { FleetState, RobotDefinition } from "../domain/models";
import { loadRobotDefinitions } from "../data/robots";
import { createEmptyFleetState, fleetReducer, type FleetAction } from "./fleetReducer";

interface FleetContextValue {
  state: FleetState;
  dispatch: Dispatch<FleetAction>;
  isLoading: boolean;
  loadError: string | null;
  // Static metadata (robotType, start), keyed by robotId. Loaded once,
  // never dispatched through the reducer — it's not runtime fleet data, so
  // it doesn't belong in FleetState (see domain/models.ts's static-vs-
  // dynamic split). Components join it against state.robots by robotId
  // wherever they need "what kind of robot is this", e.g. RobotMarker.
  robotDefinitions: Record<string, RobotDefinition>;
}

const FleetContext = createContext<FleetContextValue | null>(null);

export function FleetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fleetReducer, createEmptyFleetState());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [robotDefinitions, setRobotDefinitions] = useState<Record<string, RobotDefinition>>({});

  useEffect(() => {
    let cancelled = false;

    loadRobotDefinitions()
      .then((robots) => {
        if (cancelled) return;
        dispatch({ type: "INITIALIZE_FLEET", robots });
        setRobotDefinitions(Object.fromEntries(robots.map((r) => [r.robotId, r])));
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FleetContext.Provider value={{ state, dispatch, isLoading, loadError, robotDefinitions }}>
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet(): FleetContextValue {
  const context = useContext(FleetContext);
  if (!context) {
    throw new Error("useFleet must be used within a FleetProvider");
  }
  return context;
}
