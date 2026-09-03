// Maps a robot's source-space position (0-900, 0-560 — layout.png's actual
// pixel dimensions, 1px = 1 unit, verified directly against the image) onto
// a percentage within the map container.
//
// Percentages, not pixels: FleetMap renders the container at
// `aspect-ratio: MAP_WIDTH / MAP_HEIGHT` and lets it scale to any width, so
// "40% across, 25% down" stays correct at any rendered size — there's no
// need to measure the actual displayed pixel size in JS or hardcode a
// viewport-specific offset.

import type { Position } from "./models";
import { MAP_HEIGHT, MAP_WIDTH } from "./constants";

export interface PercentPosition {
  leftPercent: number;
  topPercent: number;
}

export function toPercentPosition(position: Position): PercentPosition {
  return {
    leftPercent: (position.x / MAP_WIDTH) * 100,
    topPercent: (position.y / MAP_HEIGHT) * 100,
  };
}
