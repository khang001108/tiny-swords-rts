import { MapPreset, MapSize, BuildingKey } from "./types";
import { MAP_SMALL } from "./map-small";
import { MAP_MEDIUM } from "./map-medium";
import { MAP_LARGE } from "./map-large";

export type { MapPreset, MapSize, BuildingKey };

/**
 * Đăng ký toàn bộ map ở đây. Thêm map mới (vd MAP_002):
 *  1. Tạo file game/maps/map-002.ts theo đúng khuôn MapPreset (copy 1 file có sẵn làm mẫu).
 *  2. Import + thêm vào record bên dưới.
 * Không cần sửa MainScene.ts / villager.ts / opponent.ts / pathfinding.ts — toàn bộ gameplay
 * đọc dữ liệu qua MapPreset nên map mới tự động có sông/cầu/đồi/rừng/pathfinding hoạt động đúng.
 */
export const MAP_PRESETS: Record<MapSize, MapPreset> = {
  small: MAP_SMALL,
  medium: MAP_MEDIUM,
  large: MAP_LARGE,
};
