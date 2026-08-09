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

export interface GameEndUpdate {
  youWin: boolean;
}
