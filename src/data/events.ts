// Loads the recorded event log from events.jsonl.
//
// This only parses the file into raw events — it does not validate/normalize
// them into FleetEvent or apply them to state. That happens in the shared
// event pipeline (validateEvent + applyEvent), not in this loading step.
//
// events.jsonl isn't valid JSON on its own (it's one JSON object per line,
// not a JSON array), so it's fetched as plain text and split/parsed line by
// line — the simplest approach that needs no bundler-specific JSONL support.

import type { RawFleetEvent } from "../domain/models";

export async function loadRecordedEvents(): Promise<RawFleetEvent[]> {
  const response = await fetch("/data/events.jsonl");
  if (!response.ok) {
    throw new Error(`Failed to load events.jsonl: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);

  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as RawFleetEvent;
    } catch (cause) {
      throw new Error(`events.jsonl line ${index + 1} is not valid JSON: ${line}`, { cause });
    }
  });
}
