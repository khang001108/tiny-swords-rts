import { MapPreset } from "./types";

export const MAP_SMALL: MapPreset = {
  size: "small",
  label: "Nhỏ",
  desc: "Đấu nhanh, căn cứ gần nhau",
  worldW: 900,
  worldH: 560,
  baseMargin: 90,
  laneYMin: 190,
  laneYMax: 470,
  grassTexture: "grass_tile_small",
  treeSpacing: 66,
  buildings: ["tower"],
  riverX: 450,
  riverWidth: 46,
  // Cầu lệch hẳn khỏi đường thẳng 2 base (midY=280) — buộc phải vòng lên trên thay vì đi thẳng
  bridgeYs: [225],
  bridgeHeight: 74,
  hillSpecs: [
    { x: 290, y: 260, scale: 0.5 },
    { x: 610, y: 390, scale: 0.45 },
  ],
  forestClusters: [{ x: 300, y: 380, count: 4, scale: 0.4 }],
  // Ngay sau bờ bên kia sông — bên nào cũng phải qua đúng cây cầu duy nhất mới lấy được
  neutralResource: { x: 533, y: 280 },
};
