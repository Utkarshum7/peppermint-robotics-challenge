import { describe, expect, it } from "vitest";
import { toPercentPosition } from "../domain/mapCoordinates";

describe("toPercentPosition", () => {
  it("maps the image origin and far corner to 0% and 100%", () => {
    expect(toPercentPosition({ x: 0, y: 0 })).toEqual({ leftPercent: 0, topPercent: 0 });
    expect(toPercentPosition({ x: 900, y: 560 })).toEqual({ leftPercent: 100, topPercent: 100 });
  });

  it("maps the center of the map to 50%/50%", () => {
    expect(toPercentPosition({ x: 450, y: 280 })).toEqual({ leftPercent: 50, topPercent: 50 });
  });

  it("matches a real robot start position from robots.json proportionally", () => {
    // r1's actual start: (569.9, 33.0)
    const result = toPercentPosition({ x: 569.9, y: 33.0 });
    expect(result.leftPercent).toBeCloseTo((569.9 / 900) * 100);
    expect(result.topPercent).toBeCloseTo((33.0 / 560) * 100);
  });
});
