import { MapPreset } from "./types";

/** Bờ biển rộng — 1 vùng nước lớn hình chữ L (sông dọc + vịnh biển ăn vào góc trên-phải) thay
 * cho 1 dải sông thẳng, 3 điểm cầu rải không đều, ít đồi/rừng để chừa đất trống cho các trận
 * đánh lớn. */
export const MAP_PLAINS: MapPreset = {
  id: "plains",
  label: "Đồng Bằng Rộng",
  desc: "Bản đồ rộng, bờ biển hình chữ L — nhiều hướng tấn công, khó phòng thủ toàn tuyến",
  worldW: 1700,
  worldH: 760,
  grassTexture: "grass_tile_large",
  buildings: ["tower", "barracks"],
  baseLeft: { x: 180, y: 380, facingDir: -1 },
  baseRight: { x: 1480, y: 280, facingDir: 1 },
  waterBodies: [
    {
      // Sông dọc chính, chia đôi bản đồ
      xMin: 820,
      xMax: 880,
      yMin: 0,
      yMax: 760,
      orientation: "vertical",
      bridgeAt: [180, 420, 650],
      bridgeGap: 65,
    },
    {
      // Vịnh biển ăn ngang vào góc trên-phải, nối với sông tạo thành hình chữ L
      xMin: 880,
      xMax: 1700,
      yMin: 0,
      yMax: 140,
      orientation: "horizontal",
      bridgeAt: [1100, 1400],
      bridgeGap: 70,
    },
  ],
  hillSpecs: [
    { x: 560, y: 330, scale: 0.5 },
    { x: 1150, y: 600, scale: 0.5 },
  ],
  forestClusters: [
    { x: 700, y: 560, count: 4, scale: 0.4 },
    { x: 1300, y: 500, count: 4, scale: 0.4 },
  ],
  neutralResources: [{ x: 950, y: 420, kind: "gold" }],
};
