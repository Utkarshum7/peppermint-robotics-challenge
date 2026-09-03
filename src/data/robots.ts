// Loads the fixed 8-robot roster from robots.json. This is the only place
// robots.json is read — RobotDefinition is static metadata, never mutated
// after this load.

import type { RobotDefinition, RobotType } from "../domain/models";

interface RawRobotDefinition {
  robot_id: string;
  robot_type: string;
  start: { x: number; y: number };
}

const VALID_ROBOT_TYPES: readonly RobotType[] = ["picker", "hauler"];

function isRobotType(value: string): value is RobotType {
  return (VALID_ROBOT_TYPES as readonly string[]).includes(value);
}

export async function loadRobotDefinitions(): Promise<RobotDefinition[]> {
  const response = await fetch("/data/robots.json");
  if (!response.ok) {
    throw new Error(`Failed to load robots.json: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as RawRobotDefinition[];

  return raw.map((entry) => {
    if (!isRobotType(entry.robot_type)) {
      throw new Error(`Unknown robot_type "${entry.robot_type}" for ${entry.robot_id}`);
    }
    return {
      robotId: entry.robot_id,
      robotType: entry.robot_type,
      start: { x: entry.start.x, y: entry.start.y },
    };
  });
}
