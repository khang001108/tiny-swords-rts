export type MapSize = "small" | "medium" | "large";
export type BuildingKey = "tower" | "barracks" | "house1" | "monastery";

/**
 * Dữ liệu 1 bản đồ — tách hẳn khỏi code gameplay (MainScene/villager/opponent không cần
 * sửa gì khi thêm map mới). Muốn tạo map tiếp theo chỉ cần thêm 1 file MAP_xxx.ts theo
 * đúng khuôn này rồi đăng ký vào game/maps/index.ts — không đụng vào logic render/AI/pathfinding.
 */
export interface MapPreset {
  size: MapSize;
  label: string;
  desc: string;
  worldW: number;
  worldH: number;
  baseMargin: number;
  laneYMin: number;
  laneYMax: number;
  grassTexture: string;
  treeSpacing: number;
  buildings: BuildingKey[];
  riverX: number;
  riverWidth: number;
  bridgeYs: number[];
  bridgeHeight: number;
  hillSpecs: { x: number; y: number; scale: number }[];
  forestClusters: { x: number; y: number; count: number; scale: number }[];
  /** Mỏ vàng trung lập giữa 2 lãnh thổ — bên nào cũng cử dân tới khai thác được, nhưng phải băng sông */
  neutralResource: { x: number; y: number } | null;
}
