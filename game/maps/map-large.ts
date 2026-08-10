import { MapPreset } from "./types";

export const MAP_LARGE: MapPreset = {
  size: "large",
  label: "Lớn",
  desc: "Trường kỳ, căn cứ đầy đủ công trình",
  worldW: 1700,
  worldH: 760,
  baseMargin: 140,
  laneYMin: 260,
  laneYMax: 680,
  grassTexture: "grass_tile_large",
  treeSpacing: 88,
  buildings: ["tower", "barracks", "house1", "monastery"],
  riverX: 850,
  riverWidth: 66,
  // 3 cầu dàn trải rộng quanh midY=380 — nhiều route thật (gần/xa/vòng xa) thay vì gần như 1 đường thẳng
  bridgeYs: [300, 470, 630],
  bridgeHeight: 70,
  hillSpecs: [
    { x: 560, y: 330, scale: 0.7 },
    { x: 1150, y: 610, scale: 0.7 },
    { x: 950, y: 715, scale: 0.5 },
    { x: 750, y: 280, scale: 0.5 },
  ],
  forestClusters: [
    { x: 720, y: 550, count: 6, scale: 0.5 },
    { x: 420, y: 560, count: 4, scale: 0.4 },
    { x: 1300, y: 320, count: 4, scale: 0.4 },
  ],
  neutralResource: { x: 943, y: 380 },
};
