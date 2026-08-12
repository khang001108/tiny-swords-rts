import Phaser from "phaser";
import TiledScene from "@/game/scenes/TiledScene";

export function createTiledGame(parent: HTMLDivElement): Phaser.Game {
  const w = Math.max(1, parent.clientWidth || window.innerWidth);
  const h = Math.max(1, parent.clientHeight || window.innerHeight);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: w,
    height: h,
    backgroundColor: "#1a3a3a",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: [TiledScene],
  });

  const onResize = () => {
    if (!parent.isConnected) return;
    game.scale.resize(parent.clientWidth || window.innerWidth, parent.clientHeight || window.innerHeight);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
  });

  return game;
}
