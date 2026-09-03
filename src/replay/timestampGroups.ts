// Groups the already-ordered raw event log into one entry per recorded
// timestamp, preserving source order both across and within groups.
//
// events.jsonl is already laid out this way — every t value appears as a
// contiguous run of 8 entries (r1..r8) in file order, verified directly
// against the file (0 non-monotonic transitions, every group exactly 8
// events, every group already in r1..r8 order). So this is
// a straightforward "start a new group when t changes" pass, not a sort —
// nothing here reorders or rebuilds the recorded sequence.

import type { RawFleetEvent } from "../domain/models";

export interface TimestampGroup {
  t: number;
  events: RawFleetEvent[];
}

export function groupEventsByTimestamp(events: RawFleetEvent[]): TimestampGroup[] {
  const groups: TimestampGroup[] = [];

  for (const event of events) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup && currentGroup.t === event.t) {
      currentGroup.events.push(event);
    } else {
      groups.push({ t: event.t, events: [event] });
    }
  }

  return groups;
}
