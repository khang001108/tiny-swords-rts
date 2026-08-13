import { MapPreset } from "./types";

/** Hồ lớn gần tròn ở giữa (ghép 3 dải nước) — 2 căn cứ ở 2 góc chéo nhau, rừng dày bao quanh
 * MỖI base với hình dạng/mật độ khác nhau (không phải cặp đối xứng), đầy đủ công trình phòng thủ. */
export const MAP_STRONGHOLD: MapPreset = {
  id: "stronghold",
  label: "Pháo Đài",
  desc: "Đầy đủ công trình phòng thủ, rừng dày bao quanh căn cứ như tường thành tự nhiên",
  worldW: 1400,
  worldH: 700,
  grassTexture: "grass_tile",
  buildings: ["tower", "barracks", "archery", "house1", "monastery"],
  baseLeft: { x: 220, y: 230, facingDir: -1 },
  baseRight: { x: 1180, y: 520, facingDir: 1 },
  waterBodies: [
    {
      xMin: 650,
      xMax: 750,
      yMin: 150,
      yMax: 550,
      orientation: "vertical",
      bridgeAt: [280, 420],
      bridgeGap: 65,
    },
    {
      // Mở rộng hồ sang phải ở phần trên — góp phần tạo hình gần tròn thay vì 1 dải thẳng
      xMin: 750,
      xMax: 950,
      yMin: 150,
      yMax: 250,
      orientation: "horizontal",
      bridgeAt: [850],
      bridgeGap: 60,
    },
    {
      // Mở rộng hồ sang trái ở phần dưới
      xMin: 550,
      xMax: 650,
      yMin: 420,
      yMax: 550,
      orientation: "horizontal",
      bridgeAt: [600],
      bridgeGap: 55,
    },
  ],
  hillSpecs: [
    { x: 350, y: 150, scale: 0.5 },
    { x: 1050, y: 600, scale: 0.55 },
    { x: 900, y: 480, scale: 0.4 },
  ],
  // Rừng quanh base trái: nhiều cụm nhỏ rải rác. Base phải: ít cụm nhưng to rậm hơn — 2 kiểu tường
  // cây khác hẳn nhau, không phải cặp đối xứng.
  forestClusters: [
    { x: 120, y: 150, count: 6, scale: 0.5 },
    { x: 120, y: 330, count: 5, scale: 0.45 },
    { x: 340, y: 330, count: 4, scale: 0.4 },
    { x: 1300, y: 450, count: 7, scale: 0.55 },
    { x: 1180, y: 640, count: 6, scale: 0.5 },
  ],
  neutralResources: [{ x: 800, y: 350, kind: "gold" }],
};
