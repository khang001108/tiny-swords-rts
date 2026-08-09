import Phaser from "phaser";
import MainScene from "@/game/scenes/MainScene";
import { MAP_PRESETS, MapSize } from "@/game/entities";

export function createPhaserGame(
  parent: HTMLDivElement,
  roomCode: string,
  isHost: boolean,
  mode: "bot" | "online",
  mapSize: MapSize
): Phaser.Game {
  const preset = MAP_PRESETS[mapSize] ?? MAP_PRESETS.medium;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: preset.worldW,
    height: preset.worldH,
    backgroundColor: "#3a5f3a",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MainScene],
  });
  game.scene.start("MainScene", { roomCode, isHost, mode, mapSize });
  return game;
}
