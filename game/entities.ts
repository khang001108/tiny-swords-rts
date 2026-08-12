export type UnitType = "pawn" | "warrior" | "archer" | "monk";

export interface UnitConfig {
  key: UnitType;
  label: string;
  cost: number;
  hp: number;
  damage: number;
  speed: number; // px/s
  range: number; // px — khoảng cách để tấn công (hoặc hồi máu, nếu role="heal")
  attackCooldownMs: number;
  spriteFrame: number; // frame tĩnh dùng làm icon/hiển thị
  role?: "attack" | "heal";
  healAmount?: number;
}

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  pawn: {
    key: "pawn",
    label: "Lính thường",
    cost: 20,
    hp: 60,
    damage: 6,
    speed: 45,
    range: 26,
    attackCooldownMs: 900,
    spriteFrame: 0,
  },
  warrior: {
    key: "warrior",
    label: "Chiến binh",
    cost: 45,
    hp: 150,
    damage: 15,
    speed: 38,
    range: 30,
    attackCooldownMs: 1000,
    spriteFrame: 0,
  },
  archer: {
    key: "archer",
    label: "Cung thủ",
    cost: 35,
    hp: 55,
    damage: 10,
    speed: 42,
    range: 130,
    attackCooldownMs: 1000,
    spriteFrame: 0,
  },
  monk: {
    key: "monk",
    label: "Thầy tu",
    cost: 40,
    hp: 50,
    damage: 0,
    speed: 40,
    range: 95,
    attackCooldownMs: 1600,
    spriteFrame: 0,
    role: "heal",
    healAmount: 14,
  },
};

export const STARTING_GOLD = 60;
export const GOLD_INCOME_PER_SEC = 1;
export const BASE_MAX_HP = 600;

// Kích thước 1 frame trong spritesheet Tiny Swords (đơn vị: px)
export const FRAME_SIZE = 192;

// ── Bản đồ — dữ liệu map đã tách ra thư mục game/maps/ (xem game/maps/index.ts) ─────────
// Re-export ở đây để mọi chỗ đang `import { MapPreset, MAP_PRESETS } from "@/game/entities"`
// không phải sửa gì — nhưng dữ liệu THẬT giờ nằm ở game/maps/, không phải trong file này nữa.
import type { MapPreset, MapId, BuildingKey } from "@/game/maps";
import { MAP_PRESETS } from "@/game/maps";
export type { MapPreset, MapId, BuildingKey };
export { MAP_PRESETS };

export const BASE_POP_CAP = 6;
export const POP_CAP_PER_BUILDING = 2;

export const TOWER_RANGE = 150;
export const TOWER_DAMAGE = 8;
export const TOWER_COOLDOWN_MS = 1400;

export interface BuildingVisual {
  key: BuildingKey;
  file: string;
  scale: number;
  offsetX: number; // lệch theo hướng "ra sau" base (dir âm/dương tự nhân theo side)
  offsetY: number;
}

export const BUILDING_VISUALS: BuildingVisual[] = [
  { key: "tower", file: "Tower", scale: 0.42, offsetX: -60, offsetY: -70 },
  { key: "barracks", file: "Barracks", scale: 0.4, offsetX: -70, offsetY: 60 },
  { key: "house1", file: "House1", scale: 0.4, offsetX: 55, offsetY: 75 },
  { key: "monastery", file: "Monastery", scale: 0.36, offsetX: 70, offsetY: -55 },
];

/** Bố cục animation trong spritesheet: hàng nào là idle/walk/attack, mỗi hàng bao nhiêu frame */
export interface AnimLayout {
  cols: number;
  idleRow: number;
  walkRow: number;
  attackRow: number;
  idleFrames: number;
  walkFrames: number;
  attackFrames: number;
  frameRate: number;
}

export const UNIT_ANIM: Record<UnitType, AnimLayout> = {
  pawn: { cols: 6, idleRow: 0, walkRow: 1, attackRow: 2, idleFrames: 6, walkFrames: 6, attackFrames: 6, frameRate: 9 },
  warrior: { cols: 6, idleRow: 0, walkRow: 1, attackRow: 2, idleFrames: 6, walkFrames: 6, attackFrames: 6, frameRate: 9 },
  archer: { cols: 8, idleRow: 0, walkRow: 1, attackRow: 2, idleFrames: 6, walkFrames: 6, attackFrames: 8, frameRate: 10 },
  // monk dùng chế độ "perAction" (UNIT_PERACTION_FRAMES) — mục này chỉ để thoả kiểu, không thực sự dùng tới.
  monk: { cols: 6, idleRow: 0, walkRow: 1, attackRow: 2, idleFrames: 6, walkFrames: 6, attackFrames: 6, frameRate: 9 },
};

function animFrames(row: number, cols: number, count: number) {
  const start = row * cols;
  return { start, end: start + count - 1 };
}
export function animFrameRange(type: UnitType, kind: "idle" | "walk" | "attack") {
  const a = UNIT_ANIM[type];
  const row = kind === "idle" ? a.idleRow : kind === "walk" ? a.walkRow : a.attackRow;
  const count = kind === "idle" ? a.idleFrames : kind === "walk" ? a.walkFrames : a.attackFrames;
  return animFrames(row, a.cols, count);
}

// ── Lính nâng cấp (Warrior/Archer dùng bộ sprite mới, mỗi hành động 1 file riêng) ──
// "pawn" vẫn dùng spritesheet cũ (1 file nhiều hàng) nên giữ nguyên animFrameRange ở trên.
export type SpriteMode = "sheet" | "perAction";

export const UNIT_SPRITE_MODE: Record<UnitType, SpriteMode> = {
  pawn: "sheet",
  warrior: "perAction",
  archer: "perAction",
  monk: "perAction",
};

export const UNIT_PERACTION_FRAMES: Partial<Record<UnitType, { idle: number; walk: number; attack: number }>> = {
  warrior: { idle: 8, walk: 6, attack: 4 },
  archer: { idle: 6, walk: 4, attack: 8 },
  monk: { idle: 6, walk: 4, attack: 11 },
};

// ── Dân (villager) — đi khai thác Gỗ / Vàng / Thịt ──────────────────────
export type ResourceKind = "wood" | "gold" | "meat";

// ── Cạn kiệt tài nguyên — Gỗ/Vàng có giới hạn thật, hết thì mỏ biến mất (Thịt/cừu giữ vô hạn) ──
export const RESOURCE_NODE_MAX_HP: Partial<Record<ResourceKind, number>> = {
  wood: 240,
  gold: 288,
};

export const RESOURCE_LABEL: Record<ResourceKind, string> = {
  wood: "Gỗ",
  gold: "Vàng",
  meat: "Thịt",
};

export const VILLAGER_HP = 35;
export const VILLAGER_SPEED = 55;
export const VILLAGER_GATHER_MS = 2200; // thời gian đứng khai thác mỗi lượt
export const VILLAGER_CARRY_AMOUNT: Record<ResourceKind, number> = {
  wood: 12,
  gold: 18,
  meat: 12,
};
export const VILLAGER_COST = 20;
export const VILLAGER_MAX_COUNT = 6;
export const VILLAGER_ARRIVE_DIST = 20;

export const VILLAGER_PERACTION_FRAMES: Record<ResourceKind, { run: number; interact: number; carry: number }> = {
  wood: { run: 6, interact: 6, carry: 6 },
  gold: { run: 6, interact: 6, carry: 6 },
  meat: { run: 6, interact: 4, carry: 6 },
};
export const VILLAGER_IDLE_FRAMES = 8;

/** Vị trí (lệch so với base, cùng quy ước offset như BUILDING_VISUALS) của các mỏ tài nguyên quanh căn cứ */
export interface ResourceNodeSpec {
  kind: ResourceKind;
  offsetX: number;
  offsetY: number;
}

export const RESOURCE_NODE_LAYOUT: ResourceNodeSpec[] = [
  { kind: "wood", offsetX: -130, offsetY: -25 },
  // Vàng đẩy ra gần biên giới/cầu hơn hẳn — mỏ giá trị nhất (18/lượt) nhưng lộ nhất, dễ bị
  // đối phương đột kích trước khi tới được lãnh thổ mình. Đây là "tài nguyên tranh chấp".
  { kind: "gold", offsetX: -195, offsetY: 95 },
  // Thịt lùi về gần base hơn — tài nguyên an toàn, ít giá trị hơn để bù lại.
  { kind: "meat", offsetX: 50, offsetY: 115 },
];

/** Mỗi 50 Gỗ+Thịt tích lũy được +1 giới hạn quân số, tối đa cộng thêm chừng này */
export const RESOURCE_CAP_UNIT = 50;
export const RESOURCE_CAP_MAX_BONUS = 6;

// ── Chế độ FFA — chọn phe/màu, đấu với tối đa 4 AI cùng lúc ──────────────
export type FactionColor = "blue" | "red" | "yellow" | "purple" | "black";
export const FACTION_COLORS: FactionColor[] = ["blue", "red", "yellow", "purple", "black"];
export const FACTION_LABEL: Record<FactionColor, string> = {
  blue: "Xanh dương",
  red: "Đỏ",
  yellow: "Vàng",
  purple: "Tím",
  black: "Đen",
};
export const FACTION_HEX: Record<FactionColor, number> = {
  blue: 0x3b82f6,
  red: 0xef4444,
  yellow: 0xeab308,
  purple: 0xa855f7,
  black: 0x475569,
};

/** Chỉ dùng Warrior/Archer cho chế độ FFA (đủ 5 màu); bỏ Pawn kiểu cũ vì không có bản màu Đen */
export type FfaUnitType = "warrior" | "archer";
export const FFA_UNIT_TYPES: FfaUnitType[] = ["warrior", "archer"];

export const FFA_WORLD_W = 1500;
export const FFA_WORLD_H = 1100;
export const FFA_BASE_MAX_HP = 500;
export const FFA_STARTING_GOLD = 70;
export const FFA_GOLD_INCOME = 3;
export const FFA_POP_CAP = 10;
// ── Kích thước khung nhìn camera (dọc, giống điện thoại thật) — bản đồ vẫn to như cũ, camera chỉ hiện 1 phần ──
export const PORTRAIT_W = 480;
export const PORTRAIT_H = 854;

export const FFA_BOT_POP_CAP = 8;

// ── Danh sách loại map hiện có, theo đúng thứ tự hiển thị trong màn chọn map ───
export const MAP_ID_ORDER: MapId[] = ["classic", "canyon", "plains", "stronghold"];

// ── Endless Mode — sóng địch vô tận, càng lâu càng khó, lưu kỷ lục ─────
export const ENDLESS_WAVE_INTERVAL_MS = 25000;
export const ENDLESS_MIN_SPAWN_MS = 550;
export const ENDLESS_SPAWN_DECAY = 0.92; // mỗi wave giảm 8% thời gian hồi lính của địch
export const ENDLESS_STAT_GROWTH = 0.09; // mỗi wave lính địch +9% máu/dame
export const ENDLESS_RECORD_KEY = "tiny-swords-endless-record";

// ── Mây trang trí (layer trên cùng của bản đồ) ─────────────────────────
export const CLOUD_KEYS = ["cloud1", "cloud2", "cloud3"];

export function computePopCap(buildingsCount: number, wood: number, meat: number): number {
  const bonus = Math.min(RESOURCE_CAP_MAX_BONUS, Math.floor((wood + meat) / RESOURCE_CAP_UNIT));
  return BASE_POP_CAP + buildingsCount * POP_CAP_PER_BUILDING + bonus;
}

// ── Nhà dân (mua thêm để nới giới hạn quân số + dân) ────────────────────
export const HOUSE_COST = 40;
export const HOUSE_POP_BONUS = 3;
export const HOUSE_VILLAGER_BONUS = 2;
export const HOUSE_MAX_COUNT = 3;
/** Vị trí các nhà dân được xây thêm, lệch dần ra so với base (theo cùng quy ước offset) */
export const HOUSE_SLOTS: { offsetX: number; offsetY: number }[] = [
  { offsetX: -160, offsetY: 60 },
  { offsetX: 160, offsetY: -70 },
  { offsetX: 150, offsetY: 130 },
];

// ── Nhà cạnh mỏ tài nguyên — xây xong tự cấp 1 dân khóa cứng vào đúng mỏ đó ──
export const RESOURCE_HOUSE_COST = 35;
export const RESOURCE_HOUSE_POP_BONUS = 2;

// ── Hiệu ứng ─────────────────────────────────────────────────────────
export const FX_DUST_FRAMES = 8;
export const FX_EXPLOSION_FRAMES = 10;
