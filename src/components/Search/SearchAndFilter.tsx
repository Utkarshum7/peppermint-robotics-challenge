// Operator discovery panel: find a robot by ID, or jump straight to the
// ones needing attention. Search text and filter mode are local UI state —
// they don't belong in FleetState (see domain/models.ts) since nothing
// else reads them. Results are derived fresh from state.robots on every
// render via filterRobots(); there is no separate/cached robot list here.
//
// Selecting a result dispatches the exact same SELECT_ROBOT action
// FleetMap's markers use — selectedRobotId remains the single source of
// truth for "which robot is selected," with no second selection state.

import { useState } from "react";
import { useFleet } from "../../state/FleetContext";
import { getAttentionReason, getStatusPresentation } from "../statusPresentation";
import { filterRobots, type AttentionFilterMode } from "./searchFiltering";
import "./SearchAndFilter.css";

export function SearchAndFilter() {
  const { state, dispatch, robotDefinitions } = useFleet();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<AttentionFilterMode>("all");

  const allRobots = Object.values(state.robots).sort((a, b) => a.robotId.localeCompare(b.robotId));
  const results = filterRobots(allRobots, searchQuery, filterMode);

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <section className="search-panel" aria-label="Find a robot">
      <h2 className="search-panel-heading">Find a Robot</h2>

      <label className="search-panel-label" htmlFor="robot-search-input">
        Search by robot ID
      </label>
      <input
        id="robot-search-input"
        type="search"
        className="search-panel-input"
        placeholder="e.g. r3"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />

      <div className="search-panel-tabs" role="group" aria-label="Filter">
        <button
          type="button"
          aria-pressed={filterMode === "all"}
          className={filterMode === "all" ? "search-tab search-tab--active" : "search-tab"}
          onClick={() => setFilterMode("all")}
        >
          All robots
        </button>
        <button
          type="button"
          aria-pressed={filterMode === "attention"}
          className={filterMode === "attention" ? "search-tab search-tab--active" : "search-tab"}
          onClick={() => setFilterMode("attention")}
        >
          Needs attention
        </button>
      </div>

      {results.length === 0 ? (
        <p className="search-panel-empty">
          {filterMode === "attention" && !hasQuery
            ? "No robots currently need attention."
            : filterMode === "attention"
              ? "No attention-worthy robots match this search."
              : "No robots match this search."}
        </p>
      ) : (
        <ul className="search-panel-results">
          {results.map((robot) => {
            const definition = robotDefinitions[robot.robotId];
            const presentation = getStatusPresentation(robot.status);
            const attentionReason = getAttentionReason(robot);
            const isSelected = state.selectedRobotId === robot.robotId;

            const resultClassName = [
              "search-result",
              `search-result--${presentation.tier}`,
              isSelected ? "search-result--selected" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={robot.robotId}>
                <button
                  type="button"
                  className={resultClassName}
                  aria-pressed={isSelected}
                  onClick={() => dispatch({ type: "SELECT_ROBOT", robotId: robot.robotId })}
                >
                  <span className="search-result-id">
                    {robot.robotId}
                    {isSelected ? " (selected)" : ""}
                  </span>
                  <span className="search-result-type">{definition?.robotType ?? "unknown"}</span>
                  <span className="search-result-status">
                    {presentation.glyph} {presentation.label}
                  </span>
                  <span className="search-result-battery">{robot.battery.toFixed(1)}%</span>
                  {attentionReason && (
                    <span className="search-result-attention">⚠ {attentionReason}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
