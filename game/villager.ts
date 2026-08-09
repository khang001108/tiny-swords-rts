import Phaser from "phaser";
import {
  ResourceKind,
  VILLAGER_ARRIVE_DIST,
  VILLAGER_CARRY_AMOUNT,
  VILLAGER_GATHER_MS,
  VILLAGER_HP,
  VILLAGER_MAX_COUNT,
  VILLAGER_SPEED,
} from "@/game/entities";

type Phase = "toNode" | "gathering" | "toBase" | "arriving";

interface Villager {
  kind: ResourceKind;
  sprite: Phaser.GameObjects.Sprite;
  phase: Phase;
  gatherUntil: number;
  x: number;
  y: number;
}

export type NodePositions = Record<ResourceKind, { x: number; y: number }>;

export class VillagerSystem {
  private villagers: Villager[] = [];
  private color: "blue" | "red";

  constructor(
    private scene: Phaser.Scene,
    color: "blue" | "red",
    private basePos: { x: number; y: number },
    private nodePos: NodePositions,
    private onDeposit: (kind: ResourceKind, amount: number) => void
  ) {
    this.color = color;
  }

  get count() {
    return this.villagers.length;
  }

  canAdd() {
    return this.villagers.length < VILLAGER_MAX_COUNT;
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
    const sprite = this.scene.add.sprite(spawnPos.x, spawnPos.y, this.texKey(assign, "run")).setScale(0.34).setDepth(9);
    sprite.play(this.animKey(assign, "run"));
    const v: Villager = { kind: assign, sprite, phase: "toNode", gatherUntil: 0, x: spawnPos.x, y: spawnPos.y };
    this.villagers.push(v);
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
      const target = v.phase === "toNode" || v.phase === "gathering" ? this.nodePos[v.kind] : this.basePos;

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
          v.sprite.play(this.animKey(v.kind, "carry"));
        }
      } else if (v.phase === "toBase") {
        this.moveToward(v, target, dt);
        if (this.dist(v, target) <= VILLAGER_ARRIVE_DIST) {
          this.onDeposit(v.kind, VILLAGER_CARRY_AMOUNT[v.kind]);
          v.phase = "toNode";
          v.sprite.play(this.animKey(v.kind, "run"));
        }
      }
      v.sprite.setPosition(v.x, v.y);
      v.sprite.setDepth(9 + v.y / 1000);
    }
  }

  private dist(v: Villager, target: { x: number; y: number }) {
    return Phaser.Math.Distance.Between(v.x, v.y, target.x, target.y);
  }

  private moveToward(v: Villager, target: { x: number; y: number }, dt: number) {
    const dx = target.x - v.x;
    const dy = target.y - v.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const step = VILLAGER_SPEED * dt;
    v.x += (dx / d) * Math.min(step, d);
    v.y += (dy / d) * Math.min(step, d);
    v.sprite.setFlipX(dx < 0);
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
