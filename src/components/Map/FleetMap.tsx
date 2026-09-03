// Layout rendering + coordinate positioning + marker composition. The
// coordinate math itself lives in domain/mapCoordinates.ts (percentage
// mapping, so alignment survives any responsive resize) — this component
// only reads it and lays out the result.

import { useFleet } from "../../state/FleetContext";
import { toPercentPosition } from "../../domain/mapCoordinates";
import { LAYOUT_IMAGE_URL } from "../../data/layout";
import { RobotMarker } from "./RobotMarker";
import "./FleetMap.css";

export function FleetMap() {
  const { state, dispatch, robotDefinitions } = useFleet();
  const robots = Object.values(state.robots);

  function selectRobot(robotId: string) {
    dispatch({ type: "SELECT_ROBOT", robotId });
  }

  return (
    <section className="fleet-map-section" aria-label="Site map">
      <div className="fleet-map-header">
        <h2 className="fleet-map-heading">Site Map</h2>
        <ul className="fleet-map-legend" aria-label="Marker status legend">
          <li className="fleet-map-legend-item fleet-map-legend-item--working">Working</li>
          <li className="fleet-map-legend-item fleet-map-legend-item--idle">Idle</li>
          <li className="fleet-map-legend-item fleet-map-legend-item--attention">Needs attention</li>
        </ul>
      </div>
      <div className="fleet-map-container">
        <img src={LAYOUT_IMAGE_URL} alt="Warehouse site layout" className="fleet-map-image" />
        {robots.map((robot) => {
          const definition = robotDefinitions[robot.robotId];
          // Every robot in state.robots came from robots.json via
          // createInitialFleetState, so a missing definition here would
          // mean a real bug, not a normal runtime condition — skip rather
          // than render a marker with an invented type.
          if (!definition) return null;

          const { leftPercent, topPercent } = toPercentPosition(robot.position);

          return (
            <RobotMarker
              key={robot.robotId}
              robot={robot}
              robotType={definition.robotType}
              leftPercent={leftPercent}
              topPercent={topPercent}
              isSelected={state.selectedRobotId === robot.robotId}
              onSelect={selectRobot}
            />
          );
        })}
      </div>
    </section>
  );
}
