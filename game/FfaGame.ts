import Phaser from "phaser";
import FfaScene from "@/game/scenes/FfaScene";
import { FactionColor, FFA_WORLD_W, FFA_WORLD_H } from "@/game/entities";

export function createFfaGame(parent: HTMLDivElement, playerColor: FactionColor, botCount: number): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: FFA_WORLD_W,
    height: FFA_WORLD_H,
    backgroundColor: "#2f4d2a",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [FfaScene],
  });
  game.scene.start("FfaScene", { playerColor, botCount });
  return game;
}
