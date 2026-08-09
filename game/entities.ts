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
    hp: 140,
    damage: 14,
    speed: 38,
    range: 30,
    attackCooldownMs: 1100,
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
export const GOLD_INCOME_PER_SEC = 4;
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
