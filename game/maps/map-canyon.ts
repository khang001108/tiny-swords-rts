import { MapPreset } from "./types";

/** Đèo núi thật — sông hẹp chạy dọc suốt bản đồ với ĐÚNG 1 cây cầu, đồi núi chốt 2 bên lối vào
 * cầu buộc quân phải len qua khe hẹp thay vì đi thẳng. Không có mỏ trung lập — kinh tế phải
 * tự lực hoàn toàn, mọi căng thẳng dồn vào đúng 1 điểm vượt sông. */
export const MAP_CANYON: MapPreset = {
  id: "canyon",
  label: "Hẻm Núi",
  desc: "Sông hẹp, chỉ 1 cây cầu duy nhất — buộc đối đầu trực diện, không né được",
  worldW: 900,
  worldH: 560,
  grassTexture: "grass_tile_small",
  buildings: ["tower"],
  baseLeft: { x: 110, y: 210, facingDir: -1 },
  baseRight: { x: 790, y: 370, facingDir: 1 },
  waterBodies: [
    {
      xMin: 430,
      xMax: 480,
      yMin: 0,
      yMax: 560,
      orientation: "vertical",
      // Đúng 1 cầu duy nhất — đây là điểm băng sông DUY NHẤT trên cả bản đồ
      bridgeAt: [300],
      bridgeGap: 95,
    },
  ],
  // Đồi chốt 2 bên lối vào cầu — buộc phải vòng qua khe hẹp giữa các quả đồi mới tới được cầu
  hillSpecs: [
    { x: 330, y: 130, scale: 0.6 },
    { x: 330, y: 460, scale: 0.55 },
    { x: 590, y: 130, scale: 0.55 },
    { x: 590, y: 460, scale: 0.6 },
  ],
  forestClusters: [
    { x: 180, y: 420, count: 4, scale: 0.4 },
    { x: 720, y: 150, count: 4, scale: 0.4 },
  ],
  neutralResources: [],
};
