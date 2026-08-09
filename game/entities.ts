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
