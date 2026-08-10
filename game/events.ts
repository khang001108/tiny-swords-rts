import Phaser from "phaser";
import { ResourceKind } from "@/game/entities";

/** Bus dùng chung để UI (React) và Scene (Phaser) giao tiếp không cần prop-drilling. */
export const gameEvents = new Phaser.Events.EventEmitter();

export interface HudUpdate {
  gold: number;
  wood: number;
  meat: number;
  myBaseHp: number;
  myBaseMaxHp: number;
  enemyBaseHp: number;
  enemyBaseMaxHp: number;
  opponentConnected: boolean;
  myUnits: number;
  popCap: number;
  villagers: number;
  villagerMax: number;
  houses: number;
  housesMax: number;
  resourceHouses: Record<ResourceKind, boolean>;
}

export interface PauseState {
  paused: boolean;
}

export type BuildingRole = "castle" | "barracks" | "tower" | "house1" | "monastery" | `resource-${ResourceKind}`;

export interface BuildingSelection {
  role: BuildingRole;
}

export interface FfaHudUpdate {
  gold: number;
  myUnits: number;
  popCap: number;
  myBaseHp: number;
  myBaseMaxHp: number;
  enemyBases: { color: string; hp: number; maxHp: number; alive: boolean }[];
}

export interface GameEndUpdate {
  youWin: boolean;
  wave?: number;
  timeSec?: number;
}

export interface EndlessWaveUpdate {
  wave: number;
}

export interface BuildingAnchor {
  x: number;
  y: number;
  flip: boolean;
}

export interface BuildModeStart {
  label: string;
}

export interface MinimapPoint {
  x: number;
  y: number;
}

export interface MinimapData {
  worldW: number;
  worldH: number;
  myBase: MinimapPoint;
  enemyBase: MinimapPoint;
  myUnits: MinimapPoint[];
  enemyUnits: MinimapPoint[];
  camera: { x: number; y: number; w: number; h: number };
}
