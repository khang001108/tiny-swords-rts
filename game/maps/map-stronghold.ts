import { MapPreset } from "./types";

/** Đầy đủ công trình phòng thủ, rừng dày bao sát 2 bên căn cứ như tường thành tự nhiên. */
export const MAP_STRONGHOLD: MapPreset = {
  id: "stronghold",
  label: "Pháo Đài",
  desc: "Đầy đủ công trình phòng thủ, rừng dày bao quanh căn cứ như tường thành tự nhiên",
  worldW: 1400,
  worldH: 700,
  baseMargin: 130,
  laneYMin: 240,
  laneYMax: 600,
  grassTexture: "grass_tile",
  treeSpacing: 70,
  buildings: ["tower", "barracks", "house1", "monastery"],
  riverX: 700,
  riverWidth: 56,
  bridgeYs: [280, 560],
  bridgeHeight: 76,
  hillSpecs: [
    { x: 480, y: 280, scale: 0.65 },
    { x: 920, y: 560, scale: 0.65 },
    { x: 700, y: 660, scale: 0.5 },
  ],
  // Cụm rừng dày áp sát 2 đầu bản đồ (gần mỗi căn cứ) — như tường cây tự nhiên che chắn
  forestClusters: [
    { x: 230, y: 250, count: 6, scale: 0.5 },
    { x: 230, y: 560, count: 5, scale: 0.45 },
    { x: 1170, y: 250, count: 5, scale: 0.45 },
    { x: 1170, y: 560, count: 6, scale: 0.5 },
  ],
  neutralResource: { x: 700, y: 420 },
};
