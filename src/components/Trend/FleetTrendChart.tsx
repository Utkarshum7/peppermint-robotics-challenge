// Real trend chart. Reads state.history — never computes or stores a
// second copy of it — and renders a hand-rolled SVG line (no charting
// library; one series, a few hundred points at most, doesn't need one).
// All the "what does this data
// mean" work already happened in domain/fleetMetrics.ts's
// deriveFleetHistoryPoint, called from the reducer — this component only
// lays the points out visually.

import { useFleet } from "../../state/FleetContext";
import { RECORDED_WINDOW_SECONDS } from "../../domain/constants";
import { plotHistory, toPolylinePoints, type TimeDomain } from "./trendChartMath";
import "./FleetTrendChart.css";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 180;
const PADDING = { left: 32, right: 12, top: 12, bottom: 22 };
const GRIDLINE_PERCENTAGES = [0, 50, 100];

export function FleetTrendChart() {
  const { state } = useFleet();
  const { history, mode } = state;

  const timeLabel = mode === "replay" ? "Recorded time (s)" : "Live simulation time (s)";

  if (history.length === 0) {
    return (
      <section className="trend-chart" aria-label="Fleet working percentage over time">
        <h2 className="trend-chart-heading">Fleet Working % Over Time</h2>
        <p className="trend-chart-empty">Start replay or live mode to build fleet trend history.</p>
      </section>
    );
  }

  // Replay has a known, fixed window (0-900s) — using it as a fixed axis
  // domain, rather than history's own min/max, means a short early-replay
  // line reads as "early progress against the full window" instead of
  // being stretched to fill the chart and looking like a dramatic swing.
  // Live has no fixed endpoint, so it keeps the dynamic domain (undefined
  // here means plotHistory falls back to history's own min/max).
  const domain: TimeDomain | undefined =
    mode === "replay" ? { minT: 0, maxT: RECORDED_WINDOW_SECONDS } : undefined;

  const plotted = plotHistory(
    history,
    {
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      paddingLeft: PADDING.left,
      paddingRight: PADDING.right,
      paddingTop: PADDING.top,
      paddingBottom: PADDING.bottom,
    },
    domain,
  );

  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const latest = history[history.length - 1];
  // Axis labels show the domain's bounds (the full 900s window for
  // replay) rather than history's own first/last point, so the axis
  // reads as "where are we in the known window," not "how far has the
  // line stretched so far."
  const axisMinT = domain?.minT ?? history[0].t;
  const axisMaxT = domain?.maxT ?? latest.t;

  return (
    <section className="trend-chart" aria-label="Fleet working percentage over time">
      <h2 className="trend-chart-heading">Fleet Working % Over Time</h2>
      <p className="trend-chart-description">
        Percentage of the 8-robot fleet currently <code>active</code> or <code>on_mission</code> — {timeLabel.toLowerCase()}.
      </p>

      <svg
        className="trend-chart-svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Line chart of fleet working percentage over ${timeLabel.toLowerCase()}; currently ${latest.workingPercentage.toFixed(0)} percent, ${latest.attentionCount} robots needing attention`}
      >
        {GRIDLINE_PERCENTAGES.map((pct) => {
          const y = PADDING.top + (1 - pct / 100) * plotHeight;
          return (
            <g key={pct}>
              <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={y} y2={y} className="trend-chart-gridline" />
              <text x={2} y={y + 3} className="trend-chart-axis-label">
                {pct}%
              </text>
            </g>
          );
        })}

        {plotted.length >= 2 && (
          <polyline points={toPolylinePoints(plotted)} className="trend-chart-line" />
        )}

        {plotted.map((p) => (
          <circle
            key={p.source.t}
            cx={p.x}
            cy={p.y}
            r={plotted.length === 1 ? 3 : 2}
            className="trend-chart-dot"
          >
            <title>
              t = {p.source.t}s: {p.source.workingPercentage.toFixed(0)}% working, {p.source.attentionCount} needing
              attention
            </title>
          </circle>
        ))}

        <text x={PADDING.left} y={CHART_HEIGHT - 4} className="trend-chart-axis-label">
          {axisMinT}s
        </text>
        <text x={CHART_WIDTH - PADDING.right} y={CHART_HEIGHT - 4} textAnchor="end" className="trend-chart-axis-label">
          {axisMaxT}s
        </text>
      </svg>

      <p className="trend-chart-current">
        Latest: {latest.workingPercentage.toFixed(0)}% working
        {latest.attentionCount > 0 ? ` · ${latest.attentionCount} needing attention` : ""} (t = {latest.t}s)
      </p>
    </section>
  );
}
