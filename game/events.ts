import Phaser from "phaser";

/** Bus dùng chung để UI (React) và Scene (Phaser) giao tiếp không cần prop-drilling. */
export const gameEvents = new Phaser.Events.EventEmitter();

export interface HudUpdate {
  gold: number;
  myBaseHp: number;
  myBaseMaxHp: number;
  enemyBaseHp: number;
  enemyBaseMaxHp: number;
  opponentConnected: boolean;
}

export interface GameEndUpdate {
  youWin: boolean;
}
