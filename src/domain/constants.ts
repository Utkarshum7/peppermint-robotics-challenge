// Values that come directly from the challenge data, verified against the
// actual files rather than assumed:
//
// - layout.png is 900x560px, 1px = 1 unit, top-left origin — no scale/flip
//   transform is needed anywhere robot positions are drawn.
// - events.jsonl runs t = 0..900 in exact 5s steps (181 ticks total).

export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 560;

export const RECORDED_WINDOW_SECONDS = 900;
export const RECORDED_TICK_INTERVAL_SECONDS = 5;
export const RECORDED_TICK_COUNT =
  RECORDED_WINDOW_SECONDS / RECORDED_TICK_INTERVAL_SECONDS + 1; // 181

// Fleet trend history bound. Comfortably above RECORDED_TICK_COUNT so a
// full replay never truncates; bounds live mode (which has no fixed
// endpoint) to roughly this many ticks x LIVE_TICK_INTERVAL_MS of wall-clock
// time (~300 x 4s ≈ 20 minutes) before the oldest points start dropping.
export const MAX_HISTORY_POINTS = 300;
