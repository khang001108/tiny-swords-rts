import Phaser from "phaser";
import {
  ResourceKind,
  VILLAGER_ARRIVE_DIST,
  VILLAGER_CARRY_AMOUNT,
  VILLAGER_GATHER_MS,
  VILLAGER_MAX_COUNT,
  VILLAGER_SPEED,
} from "@/game/entities";
import { NavGrid, findPath } from "@/game/pathfinding";

type Phase = "toNode" | "gathering" | "toBase" | "manual";

interface Villager {
  id: string;
  kind: ResourceKind;
  useNeutral: boolean; // đang khai thác mỏ trung lập giữa bản đồ thay vì mỏ riêng gần base
  sprite: Phaser.GameObjects.Sprite;
  phase: Phase;
  gatherUntil: number;
  x: number;
  y: number;
  manualTarget: { x: number; y: number } | null;
  resumePhase: "toNode" | "toBase"; // quay lại pha nào sau khi đi lệnh thủ công xong
  path: { x: number; y: number }[] | null;
  pathIndex: number;
  pathTargetKey: string;
}

export type NodePositions = Record<ResourceKind, { x: number; y: number }>;

export class VillagerSystem {
  private villagers: Villager[] = [];
  private color: "blue" | "red";
  private maxCount = VILLAGER_MAX_COUNT;
  private counter = 0;

  constructor(
    private scene: Phaser.Scene,
    color: "blue" | "red",
    private basePos: { x: number; y: number },
    private nodePos: NodePositions,
    private onDeposit: (kind: ResourceKind, amount: number, useNeutral: boolean) => void,
    private navGrid: NavGrid | null = null,
    private neutralPos: { x: number; y: number } | null = null
  ) {
    this.color = color;
  }

  get count() {
    return this.villagers.length;
  }

  get max() {
    return this.maxCount;
  }

  increaseMax(n: number) {
    this.maxCount += n;
  }

  /** navGrid được dựng SAU layoutBases (cần biết hết vị trí building) nên gán muộn qua đây */
  setNavGrid(grid: import("@/game/pathfinding").NavGrid | null) {
    this.navGrid = grid;
  }

  canAdd() {
    return this.villagers.length < this.maxCount;
  }

  /** Đếm số dân theo mỗi loại tài nguyên đang được phân công — dùng để cân bằng tải khi thêm dân mới */
  private countByKind(): Record<ResourceKind, number> {
    const c: Record<ResourceKind, number> = { wood: 0, gold: 0, meat: 0 };
    for (const v of this.villagers) c[v.kind]++;
    return c;
  }

  addVillager(kind?: ResourceKind) {
    if (!this.canAdd()) return;
    let assign = kind;
    if (!assign) {
      const counts = this.countByKind();
      assign = (Object.keys(counts) as ResourceKind[]).sort((a, b) => counts[a] - counts[b])[0];
    }
    const spawnPos = { x: this.basePos.x + Phaser.Math.Between(-16, 16), y: this.basePos.y + Phaser.Math.Between(-16, 16) };
    const sprite = this.scene.add.sprite(spawnPos.x, spawnPos.y, this.texKey(assign, "run")).setScale(0.34).setDepth(6);
    sprite.play(this.animKey(assign, "run"));
    sprite.setInteractive({ cursor: "pointer" });
    const id = `v${this.counter++}`;
    sprite.setData("villagerId", id);
    sprite.setData("kind", "my-villager");
    const v: Villager = {
      id,
      kind: assign,
      useNeutral: false,
      sprite,
      phase: "toNode",
      gatherUntil: 0,
      x: spawnPos.x,
      y: spawnPos.y,
      manualTarget: null,
      resumePhase: "toNode",
      path: null,
      pathIndex: 0,
      pathTargetKey: "",
    };
    this.villagers.push(v);
  }

  /** Danh sách sprite dân (để MainScene test va chạm chuột/chạm) */
  get sprites(): Phaser.GameObjects.Sprite[] {
    return this.villagers.map((v) => v.sprite);
  }

  getPos(id: string) {
    const v = this.villagers.find((x) => x.id === id);
    return v ? { x: v.x, y: v.y } : null;
  }

  /** Ra lệnh 1 dân di chuyển thủ công tới toạ độ bất kỳ — tạm ngưng vòng lặp khai thác cho tới khi tới nơi */
  commandMove(id: string, x: number, y: number) {
    const v = this.villagers.find((vv) => vv.id === id);
    if (!v) return;
    if (v.phase !== "manual") {
      v.resumePhase = v.phase === "toBase" ? "toBase" : "toNode";
    }
    v.phase = "manual";
    v.manualTarget = { x, y };
    v.path = null;
    v.sprite.play(this.animKey(v.kind, "run"), true);
  }

  /** Đổi loại tài nguyên dân này khai thác (bấm dân rồi bấm vào 1 mỏ khác gần base) */
  reassignKind(id: string, kind: ResourceKind) {
    const v = this.villagers.find((vv) => vv.id === id);
    if (!v) return;
    v.kind = kind;
    v.useNeutral = false;
    v.phase = "toNode";
    v.path = null;
    v.manualTarget = null;
    v.sprite.play(this.animKey(kind, "run"), true);
  }

  /** Chuyển dân này sang khai thác mỏ vàng TRUNG LẬP giữa bản đồ — phải băng sông nên dùng A* thật */
  reassignToNeutral(id: string) {
    if (!this.neutralPos) return;
    const v = this.villagers.find((vv) => vv.id === id);
    if (!v) return;
    v.kind = "gold";
    v.useNeutral = true;
    v.phase = "toNode";
    v.path = null;
    v.manualTarget = null;
    v.sprite.play(this.animKey("gold", "run"), true);
  }

  /** Mỏ 1 loại nào đó vừa cạn — dồn hết dân đang gán vào loại đó sang loại còn hàng */
  reassignAwayFrom(depletedKind: ResourceKind, fallbackKind: ResourceKind, onlyNeutral = false) {
    for (const v of this.villagers) {
      if (v.kind === depletedKind && v.useNeutral === onlyNeutral) this.reassignKind(v.id, fallbackKind);
    }
  }

  private texKey(kind: ResourceKind, phase: "run" | "interact" | "carry" | "idle") {
    if (phase === "idle") return `vill_${this.color}_idle`;
    return `vill_${this.color}_${phase}_${kind}`;
  }
  private animKey(kind: ResourceKind, phase: "run" | "interact" | "carry" | "idle") {
    return this.texKey(kind, phase) + "-anim";
  }

  update(dt: number, now: number) {
    for (const v of this.villagers) {
      if (v.phase === "manual") {
        if (v.manualTarget) {
          const arrived = this.moveToward(v, v.manualTarget, dt);
          if (arrived) {
            v.manualTarget = null;
            v.phase = v.resumePhase;
            if (v.phase === "toNode") v.sprite.play(this.animKey(v.kind, "run"), true);
            else v.sprite.play(this.animKey(v.kind, "carry"), true);
          }
        }
        v.sprite.setPosition(v.x, v.y);
        v.sprite.setDepth(6 + v.y / 1000);
        continue;
      }

      const nodeTarget = v.useNeutral && this.neutralPos ? this.neutralPos : this.nodePos[v.kind];
      const target = v.phase === "toNode" || v.phase === "gathering" ? nodeTarget : this.basePos;

      if (v.phase === "toNode") {
        this.moveToward(v, target, dt);
        if (this.dist(v, target) <= VILLAGER_ARRIVE_DIST) {
          v.phase = "gathering";
          v.gatherUntil = now + VILLAGER_GATHER_MS;
          v.sprite.play(this.animKey(v.kind, "interact"));
        }
      } else if (v.phase === "gathering") {
        if (now >= v.gatherUntil) {
          v.phase = "toBase";
          v.path = null;
          v.sprite.play(this.animKey(v.kind, "carry"));
        }
      } else if (v.phase === "toBase") {
        this.moveToward(v, target, dt);
        if (this.dist(v, target) <= VILLAGER_ARRIVE_DIST) {
          this.onDeposit(v.kind, VILLAGER_CARRY_AMOUNT[v.kind], v.useNeutral);
          v.phase = "toNode";
          v.path = null;
          v.sprite.play(this.animKey(v.kind, "run"));
        }
      }
      v.sprite.setPosition(v.x, v.y);
      v.sprite.setDepth(6 + v.y / 1000);
    }
  }

  private dist(v: Villager, target: { x: number; y: number }) {
    return Phaser.Math.Distance.Between(v.x, v.y, target.x, target.y);
  }

  /**
   * Di chuyển 1 bước hướng tới target. Nếu có navGrid (bắt buộc khi đi mỏ trung lập phải băng
   * sông) thì đi theo đường A* thật né sông/đồi/rừng — không thì đi thẳng như trước (đủ dùng cho
   * quãng ngắn quanh base, tránh tính toán thừa không cần thiết). Trả về true nếu đã tới đích.
   */
  private moveToward(v: Villager, target: { x: number; y: number }, dt: number): boolean {
    let wp = target;
    if (this.navGrid) {
      const targetKey = `${Math.round(target.x / 10)},${Math.round(target.y / 10)}`;
      if (!v.path || v.pathTargetKey !== targetKey) {
        v.path = findPath(this.navGrid, v.x, v.y, target.x, target.y);
        v.pathIndex = 0;
        v.pathTargetKey = targetKey;
      }
      if (v.path && v.path.length) {
        if (v.pathIndex >= v.path.length) v.pathIndex = v.path.length - 1;
        wp = v.path[v.pathIndex];
      }
    }
    const dx = wp.x - v.x;
    const dy = wp.y - v.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const step = VILLAGER_SPEED * dt;
    v.sprite.setFlipX(dx < 0);
    if (d <= Math.max(step, 6)) {
      v.x = wp.x;
      v.y = wp.y;
      if (this.navGrid && v.path && v.pathIndex < v.path.length - 1) {
        v.pathIndex++;
        return false; // còn waypoint tiếp theo trong đường A*, chưa phải đích cuối
      }
      const arrivedFinal = this.dist(v, target) <= VILLAGER_ARRIVE_DIST;
      return arrivedFinal;
    }
    v.x += (dx / d) * step;
    v.y += (dy / d) * step;
    return false;
  }

  destroy() {
    for (const v of this.villagers) {
      v.sprite.destroy();
    }
    this.villagers = [];
  }
}

/** Đăng ký toàn bộ animation cần cho hệ thống dân (gọi 1 lần trong preload/create của scene) */
export function createVillagerAnimations(scene: Phaser.Scene, color: "blue" | "red") {
  const kinds: ResourceKind[] = ["wood", "gold", "meat"];
  const frameCounts: Record<ResourceKind, { run: number; interact: number; carry: number }> = {
    wood: { run: 6, interact: 6, carry: 6 },
    gold: { run: 6, interact: 6, carry: 6 },
    meat: { run: 6, interact: 4, carry: 6 },
  };
  for (const kind of kinds) {
    (["run", "interact", "carry"] as const).forEach((phase) => {
      const texKey = `vill_${color}_${phase}_${kind}`;
      const animKey = `${texKey}-anim`;
      if (scene.anims.exists(animKey)) return;
      const count = frameCounts[kind][phase];
      scene.anims.create({
        key: animKey,
        frames: scene.anims.generateFrameNumbers(texKey, { start: 0, end: count - 1 }),
        frameRate: phase === "interact" ? 8 : 9,
        repeat: -1,
      });
    });
  }
}
