import { MapPreset } from "./types";

/** Chiến trường tiêu chuẩn — vẫn cân bằng/gọn gàng như trước, nhưng 2 căn cứ không còn nằm
 * đúng 1 hàng ngang, sông cũng lệch khỏi chính giữa: khác biệt nhẹ, hợp cho trận đầu tiên. */
export const MAP_CLASSIC: MapPreset = {
  id: "classic",
  label: "Cổ Điển",
  desc: "Chiến trường tiêu chuẩn, 2 cầu, cân bằng mọi mặt",
  worldW: 1280,
  worldH: 640,
  grassTexture: "grass_tile",
  buildings: ["tower", "barracks", "archery"],
  baseLeft: { x: 150, y: 260, facingDir: -1 },
  baseRight: { x: 1100, y: 420, facingDir: 1 },
  waterBodies: [
    {
      xMin: 580,
      xMax: 640,
      yMin: 0,
      yMax: 640,
      orientation: "vertical",
      // 2 cầu lệch rõ khỏi đường thẳng nối 2 base — buộc đi vòng thay vì băng thẳng qua sông
      bridgeAt: [220, 470],
      bridgeGap: 72,
    },
  ],
  hillSpecs: [
    { x: 420, y: 150, scale: 0.55 },
    { x: 900, y: 520, scale: 0.5 },
    { x: 760, y: 180, scale: 0.4 },
  ],
  forestClusters: [
    { x: 300, y: 500, count: 5, scale: 0.45 },
    { x: 950, y: 200, count: 4, scale: 0.4 },
    { x: 980, y: 480, count: 4, scale: 0.4 },
  ],
  neutralResources: [{ x: 660, y: 340, kind: "gold" }],
};
