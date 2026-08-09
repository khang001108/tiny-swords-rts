import { GameOverPayload, HitPayload, OpponentLink, Side, StatePayload, UnitSnapshot } from "@/game/net";
import {
  BASE_MAX_HP,
  BASE_POP_CAP,
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

interface BotUnit {
  id: string;
  type: UnitType;
  x: number;
  hp: number;
  maxHp: number;
  state: "walk" | "attack" | "dead";
  lastAttackAt: number;
}

type Handlers = {
  onState?: (p: StatePayload) => void;
  onHit?: (p: HitPayload) => void;
  onGameOver?: (p: GameOverPayload) => void;
  onOpponentJoined?: (side: Side) => void;
  onOpponentLeft?: () => void;
};

/**
 * AI chơi 1 mình phía "right". Không dùng mạng — mọi tương tác đi qua đúng
 * các callback mà MainScene đã có sẵn cho chế độ online (onState/onHit/onGameOver),
 * nên MainScene không cần biết đang đấu với người hay máy.
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

  private readonly leftBaseX: number;
  private readonly rightBaseX: number;
  private readonly popCap: number;

  constructor(preset: MapPreset, private difficulty: "easy" | "normal" | "hard" = "normal") {
    this.leftBaseX = preset.baseMargin;
    this.rightBaseX = preset.worldW - preset.baseMargin;
    this.popCap = BASE_POP_CAP + preset.buildings.length * POP_CAP_PER_BUILDING;
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
    const spawnEveryMs = this.difficulty === "hard" ? 1100 : this.difficulty === "easy" ? 2200 : 1600;
    this.lastTickAt = performance.now();
    this.tickTimer = setInterval(() => this.tick(), 110);
    this.spawnTimer = setInterval(() => this.maybeSpawn(), spawnEveryMs);
    this.goldTimer = setInterval(() => {
      // Bot không có dân đi khai thác, nên bù thêm để kinh tế cân bằng với người chơi
      // (người chơi có dân mỏ vàng mang về ngoài thu nhập thụ động).
      this.gold += GOLD_INCOME_PER_SEC + 3;
    }, 1000);
  }

  private stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    if (this.goldTimer) clearInterval(this.goldTimer);
    this.tickTimer = this.spawnTimer = this.goldTimer = null;
  }

  private maybeSpawn() {
    if (this.ended || this.units.size >= this.popCap) return;
    const types = Object.values(UNIT_CONFIGS).filter((c) => c.cost <= this.gold);
    if (!types.length) return;
    const cfg = types[Math.floor(Math.random() * types.length)];
    this.gold -= cfg.cost;
    const id = `${this.playerId}-${this.unitCounter++}`;
    this.units.set(id, {
      id,
      type: cfg.key,
      x: this.rightBaseX - 60,
      hp: cfg.hp,
      maxHp: cfg.hp,
      state: "walk",
      lastAttackAt: 0,
    });
  }

  private tick() {
    if (this.ended) return;
    const now = performance.now();
    const dt = Math.min(0.3, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;

    for (const u of this.units.values()) {
      const cfg = UNIT_CONFIGS[u.type];
      let nearest: UnitSnapshot | null = null;
      let nearestDist = Infinity;
      for (const hu of this.humanUnits) {
        if (hu.hp <= 0) continue;
        const d = Math.abs(hu.x - u.x);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = hu;
        }
      }
      const distToBase = Math.abs(this.leftBaseX - u.x);
      const canHitUnit = !!nearest && nearestDist <= cfg.range;
      const canHitBase = !canHitUnit && distToBase <= Math.max(cfg.range, 70);

      if (canHitUnit || canHitBase) {
        u.state = "attack";
        if (now - u.lastAttackAt >= cfg.attackCooldownMs) {
          u.lastAttackAt = now;
          if (canHitUnit && nearest) {
            this.handlers.onHit?.({ from: this.playerId, targetId: nearest.id, damage: cfg.damage });
          } else {
            this.handlers.onHit?.({ from: this.playerId, targetId: "base", damage: cfg.damage });
          }
        }
      } else {
        u.state = "walk";
        u.x -= cfg.speed * dt;
        u.x = Math.max(this.leftBaseX, Math.min(this.rightBaseX, u.x));
      }
    }

    // Tháp canh của bot tự bắn quân người chơi lại gần
    let towerTarget: UnitSnapshot | null = null;
    let towerDist = Infinity;
    for (const hu of this.humanUnits) {
      if (hu.hp <= 0) continue;
      const d = Math.abs(hu.x - (this.rightBaseX - 60));
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
      hp: u.hp,
      maxHp: u.maxHp,
      state: u.state,
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
