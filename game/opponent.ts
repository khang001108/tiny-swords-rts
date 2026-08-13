import { GameOverPayload, HitPayload, OpponentLink, Side, StatePayload, UnitSnapshot } from "@/game/net";
import { NavGrid, findPath } from "@/game/pathfinding";
import {
  BASE_MAX_HP,
  BASE_POP_CAP,
  ENDLESS_MIN_SPAWN_MS,
  ENDLESS_SPAWN_DECAY,
  ENDLESS_STAT_GROWTH,
  ENDLESS_WAVE_INTERVAL_MS,
  GOLD_INCOME_PER_SEC,
  MapPreset,
  POP_CAP_PER_BUILDING,
  STARTING_GOLD,
  TOWER_COOLDOWN_MS,
  TOWER_DAMAGE,
  TOWER_RANGE,
  UNIT_CONFIGS,
  UnitType,
} from "@/game/entities";

/** State machine đơn giản cho mỗi lính bot — thay cho kiểu "đi thẳng tới target" cũ */
type BotUnitState = "search" | "move" | "attack" | "dead";

interface BotUnit {
  id: string;
  type: UnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: BotUnitState;
  lastAttackAt: number;
  targetId: string | null; // "base" hoặc id quân người chơi đang nhắm tới
  path: { x: number; y: number }[] | null;
  pathIndex: number;
  pathTargetKey: string;
}

type Handlers = {
  onState?: (p: StatePayload) => void;
  onHit?: (p: HitPayload) => void;
  onGameOver?: (p: GameOverPayload) => void;
  onOpponentJoined?: (side: Side) => void;
  onOpponentLeft?: () => void;
};

/** Độ ưu tiên chọn mục tiêu — số càng cao càng được ưu tiên tấn công trước */
const TARGET_PRIORITY = {
  enemyUnit: 100,
  enemyBase: 50,
};

/**
 * AI chơi 1 mình phía "right". Không dùng mạng — mọi tương tác đi qua đúng
 * các callback mà MainScene đã có sẵn cho chế độ online (onState/onHit/onGameOver),
 * nên MainScene không cần biết đang đấu với người hay máy.
 *
 * State machine mỗi lính: SEARCH (tìm mục tiêu) → MOVE (đi theo đường A* thật, né
 * sông/đồi/công trình) → ATTACK (trong tầm đánh) → quay lại SEARCH khi mục tiêu chết/mất dấu.
 */
export class BotOpponent implements OpponentLink {
  readonly playerId = "bot-" + Math.random().toString(36).slice(2, 8);
  side: Side | null = "right";

  private handlers: Handlers = {};
  private gold = STARTING_GOLD;
  private baseHp = BASE_MAX_HP;
  private units = new Map<string, BotUnit>();
  private humanUnits: UnitSnapshot[] = [];
  private unitCounter = 0;
  private lastTickAt = 0;
  private towerLastAttackAt = 0;
  private ended = false;

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private spawnTimer: ReturnType<typeof setInterval> | null = null;
  private goldTimer: ReturnType<typeof setInterval> | null = null;
  private waveTimer: ReturnType<typeof setInterval> | null = null;

  private wave = 1;
  private curSpawnMs: number;
  private statMult = 1;

  // Bot luôn là "right" (quy ước có sẵn) — đọc thẳng vị trí base thật do map tự đặt, không còn
  // suy từ công thức baseMargin đối xứng.
  private readonly myBase: { x: number; y: number };
  private readonly enemyBase: { x: number; y: number };
  private readonly popCap: number;

  constructor(
    private preset: MapPreset,
    private difficulty: "easy" | "normal" | "hard" = "normal",
    private endless = false,
    private onWaveChange?: (wave: number) => void,
    private navGrid: NavGrid | null = null
  ) {
    this.myBase = { x: preset.baseRight.x, y: preset.baseRight.y };
    this.enemyBase = { x: preset.baseLeft.x, y: preset.baseLeft.y };
    this.popCap = endless ? 40 : BASE_POP_CAP + preset.buildings.length * POP_CAP_PER_BUILDING;
    this.curSpawnMs = this.difficulty === "hard" ? 1100 : this.difficulty === "easy" ? 2200 : 1600;
  }

  on(handlers: Handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  connect(): Promise<Side> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve("left");
        this.handlers.onOpponentJoined?.("right");
        this.start();
      }, 350);
    });
  }

  sendState(p: Omit<StatePayload, "from" | "t">) {
    this.humanUnits = p.units;
  }

  sendHit(targetId: string, damage: number) {
    if (this.ended) return;
    if (targetId === "base") {
      if (this.endless) return; // Endless: căn cứ địch bất tử, không có "thắng" — chỉ có sống sót
      this.baseHp = Math.max(0, this.baseHp - damage);
      if (this.baseHp <= 0) this.finish("right");
      return;
    }
    const u = this.units.get(targetId);
    if (!u || u.state === "dead") return;
    u.hp = Math.max(0, u.hp - damage);
    if (u.hp <= 0) {
      u.state = "dead";
      this.units.delete(targetId);
    }
  }

  sendGameOver(_loserSide: Side) {
    this.finish(null);
  }

  setPaused(paused: boolean) {
    if (paused) this.stop();
    else if (!this.ended) this.start();
  }

  disconnect() {
    this.stop();
  }

  private finish(loserSide: Side | null) {
    if (this.ended) return;
    this.ended = true;
    if (loserSide) this.handlers.onGameOver?.({ loserSide });
    this.stop();
  }

  private start() {
    this.lastTickAt = performance.now();
    this.tickTimer = setInterval(() => this.tick(), 110);
    this.spawnTimer = setInterval(() => this.maybeSpawn(), this.curSpawnMs);
    this.goldTimer = setInterval(() => {
      // Bot không có dân đi khai thác, nên bù thêm để kinh tế cân bằng với người chơi
      // (người chơi có dân mỏ vàng mang về ngoài thu nhập thụ động).
      this.gold += GOLD_INCOME_PER_SEC + 3;
    }, 1000);
    if (this.endless) {
      this.waveTimer = setInterval(() => this.advanceWave(), ENDLESS_WAVE_INTERVAL_MS);
    }
  }

  private advanceWave() {
    this.wave++;
    this.statMult = 1 + (this.wave - 1) * ENDLESS_STAT_GROWTH;
    this.curSpawnMs = Math.max(ENDLESS_MIN_SPAWN_MS, this.curSpawnMs * ENDLESS_SPAWN_DECAY);
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    this.spawnTimer = setInterval(() => this.maybeSpawn(), this.curSpawnMs);
    this.onWaveChange?.(this.wave);
  }

  private stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    if (this.goldTimer) clearInterval(this.goldTimer);
    if (this.waveTimer) clearInterval(this.waveTimer);
    this.tickTimer = this.spawnTimer = this.goldTimer = this.waveTimer = null;
  }

  private maybeSpawn() {
    if (this.ended || this.units.size >= this.popCap) return;
    const types = Object.values(UNIT_CONFIGS).filter((c) => c.cost <= this.gold && c.role !== "heal");
    if (!types.length) return;
    const cfg = types[Math.floor(Math.random() * types.length)];
    this.gold -= cfg.cost;
    const id = `${this.playerId}-${this.unitCounter++}`;
    const facing = this.preset.baseRight.facingDir;
    this.units.set(id, {
      id,
      type: cfg.key,
      x: this.myBase.x - facing * 60,
      y: this.myBase.y + (Math.random() * 100 - 50),
      hp: Math.round(cfg.hp * this.statMult),
      maxHp: Math.round(cfg.hp * this.statMult),
      state: "search",
      lastAttackAt: 0,
      targetId: null,
      path: null,
      pathIndex: 0,
      pathTargetKey: "",
    });
  }

  /** SEARCH_TARGET — quét toàn bộ quân + căn cứ người chơi, chọn theo độ ưu tiên (quân gần nhất > căn cứ) */
  private selectTarget(u: BotUnit): { id: string; x: number; y: number; priority: number } | null {
    let best: { id: string; x: number; y: number; priority: number } | null = null;
    let bestScore = -Infinity;
    for (const hu of this.humanUnits) {
      if (hu.hp <= 0) continue;
      const d = Math.hypot(hu.x - u.x, hu.y - u.y);
      const score = TARGET_PRIORITY.enemyUnit - d * 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = { id: hu.id, x: hu.x, y: hu.y, priority: TARGET_PRIORITY.enemyUnit };
      }
    }
    const dBase = Math.hypot(this.enemyBase.x - u.x, this.enemyBase.y - u.y);
    const baseScore = TARGET_PRIORITY.enemyBase - dBase * 0.05;
    if (baseScore > bestScore) {
      best = { id: "base", x: this.enemyBase.x, y: this.enemyBase.y, priority: TARGET_PRIORITY.enemyBase };
    }
    return best;
  }

  private followPath(u: BotUnit, targetX: number, targetY: number, speed: number, dt: number): boolean {
    const targetKey = `${Math.round(targetX / 10)},${Math.round(targetY / 10)}`;
    if (!u.path || u.pathTargetKey !== targetKey) {
      u.path = this.navGrid ? findPath(this.navGrid, u.x, u.y, targetX, targetY) : [{ x: targetX, y: targetY }];
      u.pathIndex = 0;
      u.pathTargetKey = targetKey;
    }
    const path = u.path;
    if (!path || !path.length) return false;
    if (u.pathIndex >= path.length) u.pathIndex = path.length - 1;
    const wp = path[u.pathIndex];
    const dx = wp.x - u.x;
    const dy = wp.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = speed * dt;
    if (d <= Math.max(step, 6)) {
      u.x = wp.x;
      u.y = wp.y;
      if (u.pathIndex >= path.length - 1) {
        u.path = null;
        return true; // đã tới đích cuối
      }
      u.pathIndex++;
    } else {
      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
    }
    return false;
  }

  private tick() {
    if (this.ended) return;
    const now = performance.now();
    const dt = Math.min(0.3, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;

    for (const u of this.units.values()) {
      const cfg = UNIT_CONFIGS[u.type];

      // SEARCH_TARGET — luôn quét lại mỗi tick để bắt kịp khi mục tiêu cũ đã chết/di chuyển
      const target = this.selectTarget(u);
      u.targetId = target?.id ?? null;

      const distToTarget = target ? Math.hypot(target.x - u.x, target.y - u.y) : Infinity;
      const attackRange = target?.id === "base" ? Math.max(cfg.range, 70) : cfg.range;
      const inRange = !!target && distToTarget <= attackRange;

      if (inRange && target) {
        // IN_ATTACK_RANGE → ATTACK
        u.state = "attack";
        u.path = null;
        if (now - u.lastAttackAt >= cfg.attackCooldownMs) {
          u.lastAttackAt = now;
          const dmg = Math.round(cfg.damage * this.statMult);
          this.handlers.onHit?.({ from: this.playerId, targetId: target.id, damage: dmg });
        }
      } else if (target) {
        // FIND_PATH + MOVE — đi theo đường A* thật, né sông/đồi/công trình thay vì lao thẳng
        u.state = "move";
        this.followPath(u, target.x, target.y, cfg.speed, dt);
        u.x = Math.max(20, Math.min(this.preset.worldW - 20, u.x));
        u.y = Math.max(20, Math.min(this.preset.worldH - 20, u.y));
      } else {
        u.state = "search"; // không tìm thấy mục tiêu nào (hiếm khi xảy ra vì luôn có base địch)
      }
    }

    // Tháp canh của bot tự bắn quân người chơi lại gần
    let towerTarget: UnitSnapshot | null = null;
    let towerDist = Infinity;
    const towerX = this.myBase.x - this.preset.baseRight.facingDir * 60;
    for (const hu of this.humanUnits) {
      if (hu.hp <= 0) continue;
      const d = Math.hypot(hu.x - towerX, hu.y - this.myBase.y);
      if (d < towerDist) {
        towerDist = d;
        towerTarget = hu;
      }
    }
    if (towerTarget && towerDist <= TOWER_RANGE && now - this.towerLastAttackAt >= TOWER_COOLDOWN_MS) {
      this.towerLastAttackAt = now;
      this.handlers.onHit?.({ from: this.playerId, targetId: towerTarget.id, damage: TOWER_DAMAGE });
    }

    const unitsSnap: UnitSnapshot[] = Array.from(this.units.values()).map((u) => ({
      id: u.id,
      type: u.type,
      x: u.x,
      y: u.y,
      hp: u.hp,
      maxHp: u.maxHp,
      state: u.state === "attack" ? "attack" : "walk",
    }));
    this.handlers.onState?.({
      from: this.playerId,
      side: "right",
      baseHp: this.baseHp,
      gold: this.gold,
      units: unitsSnap,
      t: Date.now(),
    });
  }
}
