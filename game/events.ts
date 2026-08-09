import Phaser from "phaser";

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
}

export interface PauseState {
  paused: boolean;
}

export type BuildingRole = "castle" | "barracks" | "tower" | "house1" | "monastery";

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
}
