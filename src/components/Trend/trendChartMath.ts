// Pure layout math for FleetTrendChart's hand-rolled SVG — kept out of JSX
// so the component stays presentation-only and this math can be
// unit-tested directly. No business logic here at all (that's
// domain/fleetMetrics.ts's deriveFleetHistoryPoint); this only turns
// already-derived history points into pixel coordinates.

import type { FleetHistoryPoint } from "../../domain/models";

export interface ChartDimensions {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
}

export interface TimeDomain {
  minT: number;
  maxT: number;
}

export interface PlottedPoint {
  x: number;
  y: number;
  source: FleetHistoryPoint;
}

// X spans `domain` if given, otherwise whatever t range is actually in this
// history. Y is always the fixed 0-100% working-percentage range, true in
// either mode.
//
// Replay passes a fixed {0, RECORDED_WINDOW_SECONDS} domain (see
// FleetTrendChart.tsx) rather than always deriving from history's own
// min/max — early in a replay run, only 2-3 points exist, and stretching
// just that sliver across the full chart width would make a small change
// look like a dramatic swing, then look negligible again once more points
// arrive. A fixed domain shows a short line against the known 900s
// window instead, which reads as "early progress," not "wild swing." Live
// mode has no fixed endpoint, so it keeps deriving from history.
export function plotHistory(
  history: FleetHistoryPoint[],
  dims: ChartDimensions,
  domain?: TimeDomain,
): PlottedPoint[] {
  if (history.length === 0) return [];

  const minT = domain?.minT ?? history[0].t;
  const maxT = domain?.maxT ?? history[history.length - 1].t;
  const tRange = maxT - minT;

  const plotWidth = dims.width - dims.paddingLeft - dims.paddingRight;
  const plotHeight = dims.height - dims.paddingTop - dims.paddingBottom;

  return history.map((point) => {
    // A single point (or a session where t hasn't advanced past the first
    // tick yet) has no range to spread across — anchor at the left edge
    // rather than dividing by zero. Doesn't happen with a fixed domain
    // (tRange is always 900), only when deriving from history itself.
    const xRatio = tRange === 0 ? 0 : (point.t - minT) / tRange;
    const yRatio = point.workingPercentage / 100;

    return {
      x: dims.paddingLeft + xRatio * plotWidth,
      y: dims.paddingTop + (1 - yRatio) * plotHeight,
      source: point,
    };
  });
}

export function toPolylinePoints(plotted: PlottedPoint[]): string {
  return plotted.map((p) => `${p.x},${p.y}`).join(" ");
}
