import Phaser from "phaser";
import MainScene from "@/game/scenes/MainScene";
import { MapSize, PORTRAIT_W, PORTRAIT_H } from "@/game/entities";

// Khung nhìn camera cố định theo tỉ lệ dọc — thế giới (bản đồ) vẫn to như cũ,
// camera chỉ hiện 1 phần và kéo/vuốt để xem chỗ khác (giống game RTS mobile thật).

export function createPhaserGame(
  parent: HTMLDivElement,
  roomCode: string,
  isHost: boolean,
  mode: "bot" | "online" | "endless",
  mapSize: MapSize
): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: PORTRAIT_W,
    height: PORTRAIT_H,
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

