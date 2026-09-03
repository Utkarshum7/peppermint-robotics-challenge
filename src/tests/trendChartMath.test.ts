import { describe, expect, it } from "vitest";
import type { FleetHistoryPoint } from "../domain/models";
import { plotHistory, toPolylinePoints } from "../components/Trend/trendChartMath";

const dims = { width: 100, height: 50, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 };

function point(t: number, workingPercentage: number): FleetHistoryPoint {
  return { t, workingPercentage, attentionCount: 0 };
}

describe("plotHistory", () => {
  it("returns nothing for empty history", () => {
    expect(plotHistory([], dims)).toEqual([]);
  });

  it("maps 0% to the bottom and 100% to the top of the plot area", () => {
    const [bottom, top] = plotHistory([point(0, 0), point(10, 100)], dims);
    expect(bottom.y).toBe(dims.height);
    expect(top.y).toBe(0);
  });

  it("maps the earliest and latest t to the left and right edges", () => {
    const [first, last] = plotHistory([point(100, 50), point(200, 50)], dims);
    expect(first.x).toBe(0);
    expect(last.x).toBe(dims.width);
  });

  it("anchors a single point at the left edge instead of dividing by zero", () => {
    const [only] = plotHistory([point(50, 75)], dims);
    expect(only.x).toBe(0);
    expect(Number.isFinite(only.y)).toBe(true);
  });

  it("builds a valid SVG points string", () => {
    const plotted = plotHistory([point(0, 0), point(10, 100)], dims);
    expect(toPolylinePoints(plotted)).toBe("0,50 100,0");
  });

  describe("with a fixed domain (replay's 0-900s window)", () => {
    const domain = { minT: 0, maxT: 900 };

    it("places early points near the left edge instead of stretching them across the whole width", () => {
      // Only 10s of a 900s window has happened — without a fixed domain
      // this would incorrectly span the full chart (see the no-domain
      // "earliest and latest t" test above using the same two points).
      const [first, last] = plotHistory([point(0, 0), point(10, 50)], dims, domain);
      expect(first.x).toBe(0);
      expect(last.x).toBeCloseTo((10 / 900) * dims.width, 5);
      expect(last.x).toBeLessThan(dims.width * 0.05); // nowhere near the right edge
    });

    it("never divides by zero even for a single point, since the domain range is fixed", () => {
      const [only] = plotHistory([point(0, 0)], dims, domain);
      expect(only.x).toBe(0);
      expect(Number.isFinite(only.y)).toBe(true);
    });

    it("places a point at the domain's own maxT at the right edge, even without history reaching it", () => {
      const [, atEnd] = plotHistory([point(0, 0), point(900, 100)], dims, domain);
      expect(atEnd.x).toBe(dims.width);
    });
  });
});
