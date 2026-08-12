import { MapPreset } from "./types";

/** Bản đồ rộng, 3 cầu rải đều, ít vật cản — nhiều hướng tấn công, khó phòng thủ toàn tuyến. */
export const MAP_PLAINS: MapPreset = {
  id: "plains",
  label: "Đồng Bằng Rộng",
  desc: "Bản đồ rộng, 3 cây cầu rải đều — nhiều hướng tấn công, khó phòng thủ toàn tuyến",
  worldW: 1700,
  worldH: 760,
  baseMargin: 140,
  laneYMin: 260,
  laneYMax: 680,
  grassTexture: "grass_tile_large",
  treeSpacing: 90,
  buildings: ["tower", "barracks"],
  riverX: 850,
  riverWidth: 60,
  // 3 cầu dàn trải rộng quanh midY=380 — nhiều route thật (gần/xa/vòng xa) thay vì gần như 1 đường thẳng
  bridgeYs: [300, 470, 630],
  bridgeHeight: 68,
  // Ít đồi hơn hẳn các map khác — chủ ý để lại nhiều đất trống cho các đợt tấn công lớn
  hillSpecs: [
    { x: 560, y: 330, scale: 0.55 },
    { x: 1150, y: 610, scale: 0.55 },
  ],
  forestClusters: [
    { x: 720, y: 550, count: 4, scale: 0.4 },
    { x: 1300, y: 320, count: 4, scale: 0.4 },
  ],
  neutralResource: { x: 943, y: 380 },
};
