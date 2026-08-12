import { MapPreset, MapId, BuildingKey } from "./types";
import { MAP_CLASSIC } from "./map-classic";
import { MAP_CANYON } from "./map-canyon";
import { MAP_PLAINS } from "./map-plains";
import { MAP_STRONGHOLD } from "./map-stronghold";

export type { MapPreset, MapId, BuildingKey };

/**
 * Đăng ký toàn bộ map ở đây. Thêm map mới (vd MAP_002):
 *  1. Tạo file game/maps/map-002.ts theo đúng khuôn MapPreset (copy 1 file có sẵn làm mẫu).
 *  2. Import + thêm vào record bên dưới + thêm vào MAP_ID_ORDER trong game/entities.ts.
 * Không cần sửa MainScene.ts / villager.ts / opponent.ts / pathfinding.ts — toàn bộ gameplay
 * đọc dữ liệu qua MapPreset nên map mới tự động có sông/cầu/đồi/rừng/pathfinding hoạt động đúng.
 */
export const MAP_PRESETS: Record<MapId, MapPreset> = {
  classic: MAP_CLASSIC,
  canyon: MAP_CANYON,
  plains: MAP_PLAINS,
  stronghold: MAP_STRONGHOLD,
};
