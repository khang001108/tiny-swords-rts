export type UnitType = "pawn" | "warrior" | "archer";

export interface UnitConfig {
  key: UnitType;
  label: string;
  cost: number;
  hp: number;
  damage: number;
  speed: number; // px/s
  range: number; // px — khoảng cách để tấn công
  attackCooldownMs: number;
  spriteFrame: number; // frame tĩnh dùng làm icon/hiển thị
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
};

export const STARTING_GOLD = 60;
export const GOLD_INCOME_PER_SEC = 1;
export const BASE_MAX_HP = 600;

// Kích thước 1 frame trong spritesheet Tiny Swords (đơn vị: px)
export const FRAME_SIZE = 192;

// ── Bản đồ ────────────────────────────────────────────────────────────
export type MapSize = "small" | "medium" | "large";
export type BuildingKey = "tower" | "barracks" | "house1" | "monastery";

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
}

export const MAP_PRESETS: Record<MapSize, MapPreset> = {
  small: {
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
    bridgeYs: [330],
    bridgeHeight: 74,
    hillSpecs: [{ x: 290, y: 250, scale: 0.5 }],
  },
  medium: {
    size: "medium",
    label: "Vừa",
    desc: "Cân bằng, nhiều không gian điều quân",
    worldW: 1280,
    worldH: 640,
    baseMargin: 110,
    laneYMin: 220,
    laneYMax: 560,
    grassTexture: "grass_tile",
    treeSpacing: 78,
    buildings: ["tower", "barracks"],
    riverX: 640,
    riverWidth: 58,
    bridgeYs: [315, 465],
    bridgeHeight: 72,
    hillSpecs: [
      { x: 420, y: 260, scale: 0.6 },
      { x: 860, y: 500, scale: 0.6 },
    ],
  },
  large: {
    size: "large",
    label: "Lớn",
    desc: "Trường kỳ, căn cứ đầy đủ công trình",
    worldW: 1700,
    worldH: 760,
    baseMargin: 140,
    laneYMin: 260,
    laneYMax: 680,
    grassTexture: "grass_tile_large",
    treeSpacing: 88,
    buildings: ["tower", "barracks", "house1", "monastery"],
    riverX: 850,
    riverWidth: 66,
    bridgeYs: [352, 470, 588],
    bridgeHeight: 70,
    hillSpecs: [
      { x: 560, y: 330, scale: 0.7 },
      { x: 1150, y: 610, scale: 0.7 },
      { x: 850, y: 715, scale: 0.5 },
    ],
  },
};

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
};

export const UNIT_PERACTION_FRAMES: Partial<Record<UnitType, { idle: number; walk: number; attack: number }>> = {
  warrior: { idle: 8, walk: 6, attack: 4 },
  archer: { idle: 6, walk: 4, attack: 8 },
};

// ── Dân (villager) — đi khai thác Gỗ / Vàng / Thịt ──────────────────────
export type ResourceKind = "wood" | "gold" | "meat";

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
  { kind: "gold", offsetX: 95, offsetY: 100 },
  { kind: "meat", offsetX: -110, offsetY: 115 },
];

/** Mỗi 50 Gỗ+Thịt tích lũy được +1 giới hạn quân số, tối đa cộng thêm chừng này */
export const RESOURCE_CAP_UNIT = 50;
export const RESOURCE_CAP_MAX_BONUS = 6;

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

// ── Hiệu ứng ─────────────────────────────────────────────────────────
export const FX_DUST_FRAMES = 8;
export const FX_EXPLOSION_FRAMES = 10;
