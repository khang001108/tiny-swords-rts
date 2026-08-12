import { MapPreset } from "./types";

/** Sông hẹp, đúng 1 cây cầu ngay giữa — không có đường vòng, không có mỏ trung lập để tranh. */
export const MAP_CANYON: MapPreset = {
  id: "canyon",
  label: "Hẻm Núi",
  desc: "Sông hẹp, chỉ 1 cây cầu duy nhất — buộc đối đầu trực diện, không né được",
  worldW: 900,
  worldH: 560,
  baseMargin: 90,
  laneYMin: 190,
  laneYMax: 470,
  grassTexture: "grass_tile_small",
  treeSpacing: 66,
  buildings: ["tower"],
  riverX: 450,
  riverWidth: 50,
  // Đúng giữa map (midY=280) — đây là điểm băng sông DUY NHẤT, không có cầu phụ để vòng tránh
  bridgeYs: [280],
  bridgeHeight: 80,
  hillSpecs: [
    { x: 290, y: 180, scale: 0.55 },
    { x: 610, y: 380, scale: 0.5 },
    { x: 450, y: 480, scale: 0.45 },
  ],
  forestClusters: [
    { x: 250, y: 420, count: 5, scale: 0.45 },
    { x: 650, y: 150, count: 4, scale: 0.4 },
  ],
  // Không có mỏ trung lập — kinh tế phải tự lực hoàn toàn, độ căng dồn hết vào cây cầu độc đạo
  neutralResource: null,
};
