import Phaser from "phaser";
import MainScene from "@/game/scenes/MainScene";
import { MapSize } from "@/game/entities";

/**
 * Canvas giờ luôn khớp đúng kích thước thật của khung chứa (container) —
 * không còn ép cứng về kích thước dọc (480x854) như trước. Nhờ vậy game tự
 * thích ứng khi xoay ngang: Scale.RESIZE cập nhật lại canvas + camera viewport
 * mỗi khi container đổi kích thước, KHÔNG reset scene/state.
 */
export function createPhaserGame(
  parent: HTMLDivElement,
  roomCode: string,
  isHost: boolean,
  mode: "bot" | "online" | "endless",
  mapSize: MapSize
): Phaser.Game {
  const w = Math.max(1, parent.clientWidth || window.innerWidth);
  const h = Math.max(1, parent.clientHeight || window.innerHeight);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: w,
    height: h,
    backgroundColor: "#3a5f3a",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: [MainScene],
  });
  game.scene.start("MainScene", { roomCode, isHost, mode, mapSize });

  // window.innerWidth/innerHeight đổi khi xoay máy — resize lại canvas thật (không hard-code kích thước).
  const onResize = () => {
    if (!parent.isConnected) return;
    const nw = Math.max(1, parent.clientWidth || window.innerWidth);
    const nh = Math.max(1, parent.clientHeight || window.innerHeight);
    game.scale.resize(nw, nh);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
  });

  return game;
}

