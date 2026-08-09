import Phaser from "phaser";
import MainScene from "@/game/scenes/MainScene";

export function createPhaserGame(
  parent: HTMLDivElement,
  roomCode: string,
  isHost: boolean
): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 640,
    backgroundColor: "#3a5f3a",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MainScene],
  });
  game.scene.start("MainScene", { roomCode, isHost });
  return game;
}
