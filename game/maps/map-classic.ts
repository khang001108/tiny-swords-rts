import { MapPreset } from "./types";

/** Chiến trường tiêu chuẩn — cân bằng mọi mặt, hợp cho trận đầu tiên. */
export const MAP_CLASSIC: MapPreset = {
  id: "classic",
  label: "Cổ Điển",
  desc: "Chiến trường tiêu chuẩn, 2 cầu, cân bằng mọi mặt",
  worldW: 1280,
  worldH: 640,
  baseMargin: 110,
  laneYMin: 220,
  laneYMax: 560,
  grassTexture: "grass_tile",
  treeSpacing: 78,
  buildings: ["tower", "barracks"],
  riverX: 640,
  riverWidth: 58,
  // 2 cầu lệch rõ khỏi midY=320 theo 2 hướng ngược nhau — có route "vòng trên" và "vòng dưới" thật sự
  bridgeYs: [255, 520],
  bridgeHeight: 72,
  hillSpecs: [
    { x: 420, y: 260, scale: 0.6 },
    { x: 860, y: 500, scale: 0.6 },
    { x: 740, y: 235, scale: 0.42 },
  ],
  forestClusters: [
    { x: 520, y: 420, count: 5, scale: 0.45 },
    { x: 300, y: 480, count: 4, scale: 0.4 },
    { x: 980, y: 250, count: 4, scale: 0.4 },
  ],
  neutralResource: { x: 729, y: 320 },
};
