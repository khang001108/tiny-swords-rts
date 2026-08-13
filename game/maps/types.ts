import type { ResourceKind } from "@/game/entities";

export type MapId = "classic" | "canyon" | "plains" | "stronghold";
export type BuildingKey = "tower" | "barracks" | "house1" | "monastery";

/** Vị trí + hướng của 1 căn cứ — đặt tay bởi tác giả map, không suy ra bằng công thức
 *  đối xứng, nên `baseLeft`/`baseRight` không cần cùng hàng hay cách đều 2 mép map. */
export interface BaseSpec {
  x: number;
  y: number;
  /** Dấu lệch cụm công trình/tài nguyên ra "sau lưng" base này (theo trục X) — mỗi base
   *  tự chọn dấu phù hợp với địa hình quanh nó, không còn suy từ mySide==="left". */
  facingDir: 1 | -1;
}

/** 1 dải nước (sông/hồ/biển) hình chữ nhật — ghép nhiều dải lại để tạo hình dạng phức tạp
 *  hơn (chữ L, hồ gần tròn...) mà không cần polygon thật. */
export interface WaterBand {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Trục đặt cầu: "vertical" = dải nước chạy dọc, cầu bắc ngang (bridgeAt là toạ độ Y);
   *  "horizontal" = dải nước chạy ngang, cầu bắc dọc (bridgeAt là toạ độ X). */
  orientation: "vertical" | "horizontal";
  bridgeAt: number[];
  bridgeGap: number;
}

/**
 * Dữ liệu 1 bản đồ — tách hẳn khỏi code gameplay (MainScene/villager/opponent không cần
 * sửa gì khi thêm map mới). Muốn tạo map tiếp theo chỉ cần thêm 1 file map-xxx.ts theo
 * đúng khuôn này rồi đăng ký vào game/maps/index.ts — không đụng vào logic render/AI/pathfinding.
 */
export interface MapPreset {
  id: MapId;
  label: string;
  desc: string;
  worldW: number;
  worldH: number;
  grassTexture: string;
  buildings: BuildingKey[];
  baseLeft: BaseSpec; // host
  baseRight: BaseSpec; // guest
  waterBodies: WaterBand[];
  hillSpecs: { x: number; y: number; scale: number }[];
  forestClusters: { x: number; y: number; count: number; scale: number }[];
  /** Mỏ tài nguyên trung lập — cả 2 bên đều cử dân tới khai thác được, nhưng phải băng qua
   *  đúng chỗ có cầu. Danh sách rỗng = map không có mỏ trung lập. */
  neutralResources: { x: number; y: number; kind: ResourceKind }[];
}
