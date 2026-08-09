import Phaser from "phaser";
import {
  FACTION_COLORS,
  FACTION_HEX,
  FactionColor,
  FFA_BASE_MAX_HP,
  FFA_BOT_POP_CAP,
  FFA_GOLD_INCOME,
  FFA_POP_CAP,
  FFA_UNIT_TYPES,
  FfaUnitType,
  FFA_WORLD_H,
  FFA_WORLD_W,
  FFA_STARTING_GOLD,
  FRAME_SIZE,
  TOWER_COOLDOWN_MS,
  TOWER_DAMAGE,
  TOWER_RANGE,
  UNIT_CONFIGS,
} from "@/game/entities";
import { gameEvents } from "@/game/events";

interface FfaUnit {
  id: string;
  owner: number; // 0 = người chơi, 1..N = bot
  type: FfaUnitType;
  spriteKey: string;
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: "walk" | "attack" | "dead";
  lastAnimState: "walk" | "attack";
  lastAttackAt: number;
  manualTarget: { x: number; y: number } | null;
}

interface FfaBase {
  owner: number;
  color: FactionColor;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  castle: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
  gold: number;
  lastSpawnAt: number;
  spawnEveryMs: number;
  towerPos: { x: number; y: number };
  towerLastAttackAt: number;
}

const BASE_HIT_RADIUS = 60;

export default class FfaScene extends Phaser.Scene {
  private playerColor!: FactionColor;
  private botColors: FactionColor[] = [];
  private bases: FfaBase[] = [];
  private units = new Map<string, FfaUnit>();
  private unitCounter = 0;
  private gold = FFA_STARTING_GOLD;
  private gameOver = false;
  private paused = false;

  private selected: string | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private minimapG!: Phaser.GameObjects.Graphics;

  constructor() {
    super("FfaScene");
  }

  init(data: { playerColor: FactionColor; botCount: number }) {
    this.playerColor = data.playerColor;
    this.botColors = FACTION_COLORS.filter((c) => c !== data.playerColor).slice(0, Phaser.Math.Clamp(data.botCount, 1, 4));
    this.bases = [];
    this.units.clear();
    this.unitCounter = 0;
    this.gold = FFA_STARTING_GOLD;
    this.gameOver = false;
    this.paused = false;
    this.selected = null;
  }

  preload() {
    this.load.image("grass_tile", "/assets/terrain/grass_tile.png");
    this.load.image("tree_a", "/assets/terrain/tree_a.png");
    this.load.image("tree_b", "/assets/terrain/tree_b.png");
    this.load.image("tree_c", "/assets/terrain/tree_c.png");
    this.load.image("deco_bush", "/assets/terrain/deco/bush.png");
    this.load.image("deco_bush2", "/assets/terrain/deco/bush2.png");
    this.load.image("deco_rock", "/assets/terrain/deco/rock.png");
    this.load.image("deco_mushroom", "/assets/terrain/deco/mushroom.png");

    const allColors: FactionColor[] = ["blue", "red", "yellow", "purple", "black"];
    for (const color of allColors) {
      const Cap = color.charAt(0).toUpperCase() + color.slice(1);
      this.load.image(`ffa_castle_${color}`, `/assets/buildings/Castle_${Cap}.png`);
      this.load.image(`ffa_tower_${color}`, `/assets/buildings/Tower_${Cap}.png`);
      for (const type of FFA_UNIT_TYPES) {
        (["idle", "run", "attack"] as const).forEach((phase) => {
          this.load.spritesheet(`ffa_${type}_${color}_${phase}`, `/assets/units2/${type}_${color}_${phase}.png`, {
            frameWidth: FRAME_SIZE,
            frameHeight: FRAME_SIZE,
          });
        });
      }
    }
  }

  create() {
    this.createAnims();
    this.buildMap();
    this.layoutBases();

    this.selectionRing = this.add.graphics().setDepth(12);
    this.minimapG = this.add.graphics().setDepth(100).setScrollFactor(0);

    this.input.on("pointerdown", this.handlePointerDown, this);
    gameEvents.on("ffa-spawn-unit", this.handleSpawn, this);
    gameEvents.on("ffa-toggle-pause", this.handleTogglePause, this);
    gameEvents.on("leave-room", this.handleLeave, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", this.handlePointerDown, this);
      gameEvents.off("ffa-spawn-unit", this.handleSpawn, this);
      gameEvents.off("ffa-toggle-pause", this.handleTogglePause, this);
      gameEvents.off("leave-room", this.handleLeave, this);
    });

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.gameOver || this.paused) return;
        this.gold += FFA_GOLD_INCOME;
        for (const b of this.bases) if (b.owner !== 0 && b.alive) b.gold += FFA_GOLD_INCOME + 2;
        this.emitHud();
      },
    });

    this.emitHud();
  }

  private handleTogglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    gameEvents.emit("pause-state", { paused: this.paused });
  }

  private handleLeave() {
    // FFA không dùng mạng — không cần dọn kết nối gì thêm
  }

  private createAnims() {
    const allColors: FactionColor[] = ["blue", "red", "yellow", "purple", "black"];
    const frames: Record<FfaUnitType, { idle: number; run: number; attack: number }> = {
      warrior: { idle: 8, run: 6, attack: 4 },
      archer: { idle: 6, run: 4, attack: 8 },
    };
    for (const color of allColors) {
      for (const type of FFA_UNIT_TYPES) {
        (["idle", "run", "attack"] as const).forEach((phase) => {
          const key = `ffa_${type}_${color}_${phase}`;
          const animKey = `${key}-anim`;
          if (this.anims.exists(animKey)) return;
          const count = frames[type][phase];
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(key, { start: 0, end: count - 1 }),
            frameRate: phase === "attack" ? 12 : 10,
            repeat: phase === "attack" ? 0 : -1,
          });
        });
      }
    }
  }

  private buildMap() {
    this.cameras.main.setBackgroundColor("#2f4d2a");
    const bg = this.add.tileSprite(0, 0, FFA_WORLD_W, FFA_WORLD_H, "grass_tile").setOrigin(0, 0).setDepth(0);
    bg.setTileScale(0.9, 0.9);

    const treeKeys = ["tree_a", "tree_b", "tree_c"];
    let i = 0;
    for (let x = -10; x < FFA_WORLD_W + 40; x += 82) {
      const key = treeKeys[i % treeKeys.length];
      this.add.image(x, 16, key).setScale(0.4).setDepth(3).setOrigin(0.5, 0.85);
      this.add.image(x + 41, FFA_WORLD_H - 8, key).setScale(0.4).setDepth(3).setFlipY(true).setOrigin(0.5, 0.15);
      this.add.image(16, x, key).setScale(0.36).setDepth(3).setAngle(-90).setOrigin(0.5, 0.85);
      this.add.image(FFA_WORLD_W - 8, x, key).setScale(0.36).setDepth(3).setAngle(90).setOrigin(0.5, 0.85);
      i++;
    }
    const decoKeys = ["deco_bush", "deco_bush2", "deco_rock", "deco_mushroom"];
    for (let d = 0; d < 14; d++) {
      const x = Phaser.Math.Between(120, FFA_WORLD_W - 120);
      const y = Phaser.Math.Between(120, FFA_WORLD_H - 120);
      this.add.image(x, y, decoKeys[d % decoKeys.length]).setScale(0.45).setDepth(1).setAlpha(0.5);
    }
  }

  private layoutBases() {
    const humanX = FFA_WORLD_W / 2;
    const humanY = FFA_WORLD_H - 130;
    this.bases.push(this.makeBase(0, this.playerColor, humanX, humanY));

    const n = this.botColors.length;
    for (let i = 0; i < n; i++) {
      const bx = FFA_WORLD_W * ((i + 1) / (n + 1));
      const by = 150;
      this.bases.push(this.makeBase(i + 1, this.botColors[i], bx, by));
    }
  }

  private makeBase(owner: number, color: FactionColor, x: number, y: number): FfaBase {
    const castle = this.add.image(x, y, `ffa_castle_${color}`).setScale(0.46).setDepth(5);
    const hpBar = this.add.graphics().setDepth(6);
    const shadow = this.add.graphics().setDepth(4);
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillEllipse(x, y + 62, 110, 22);
    const towerY = owner === 0 ? y - 90 : y + 90;
    const tower = this.add.image(x + 90, towerY, `ffa_tower_${color}`).setScale(0.36).setDepth(4);
    if (owner === 0) {
      castle.setInteractive({ cursor: "pointer" });
      castle.setData("kind", "my-building-ffa");
    } else {
      castle.setInteractive({ cursor: "pointer" });
      castle.setData("kind", "enemy-ffa");
      castle.setData("owner", owner);
    }
    return {
      owner,
      color,
      x,
      y,
      hp: FFA_BASE_MAX_HP,
      maxHp: FFA_BASE_MAX_HP,
      alive: true,
      castle,
      hpBar,
      gold: FFA_STARTING_GOLD,
      lastSpawnAt: 0,
      spawnEveryMs: Phaser.Math.Between(1400, 2000),
      towerPos: { x: x + 90, y: towerY },
      towerLastAttackAt: 0,
    };
  }

  // ── Sản xuất quân ──────────────────────────────────────────────────
  private handleSpawn(type: FfaUnitType) {
    if (this.gameOver) return;
    const base = this.bases[0];
    const cfg = UNIT_CONFIGS[type];
    const myCount = Array.from(this.units.values()).filter((u) => u.owner === 0 && u.state !== "dead").length;
    if (myCount >= FFA_POP_CAP || this.gold < cfg.cost) return;
    this.gold -= cfg.cost;
    this.spawnUnit(0, this.playerColor, type, base.x + Phaser.Math.Between(-30, 30), base.y + Phaser.Math.Between(20, 50));
    this.emitHud();
  }

  private spawnUnit(owner: number, color: FactionColor, type: FfaUnitType, x: number, y: number) {
    const cfg = UNIT_CONFIGS[type];
    const id = `u${owner}-${this.unitCounter++}`;
    const spriteKey = `ffa_${type}_${color}`;
    const sprite = this.add.sprite(x, y, `${spriteKey}_run`, 0).setScale(0.38).setDepth(10);
    sprite.play(`${spriteKey}_run-anim`);
    sprite.setScale(0);
    this.tweens.add({ targets: sprite, scale: 0.38, duration: 200, ease: "Back.Out" });
    if (owner === 0) {
      sprite.setInteractive({ cursor: "pointer" });
      sprite.setData("kind", "my-unit-ffa");
      sprite.setData("unitId", id);
    } else {
      sprite.setInteractive({ cursor: "pointer" });
      sprite.setData("kind", "enemy-ffa-unit");
      sprite.setData("unitId", id);
    }
    const hpBar = this.add.graphics().setDepth(11);
    this.units.set(id, {
      id,
      owner,
      type,
      spriteKey,
      sprite,
      hpBar,
      x,
      y,
      hp: cfg.hp,
      maxHp: cfg.hp,
      state: "walk",
      lastAnimState: "walk",
      lastAttackAt: 0,
      manualTarget: null,
    });
  }

  // ── Điều khiển ────────────────────────────────────────────────────
  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (this.gameOver || this.paused) return;
    const hits = this.input.hitTestPointer(pointer) as Phaser.GameObjects.GameObject[];
    const hit = hits[0];
    if (hit) {
      const kind = hit.getData("kind");
      if (kind === "my-unit-ffa") {
        this.selected = hit.getData("unitId");
        return;
      }
      if ((kind === "enemy-ffa" || kind === "enemy-ffa-unit") && this.selected) {
        const obj = hit as unknown as { x: number; y: number };
        this.issueMoveCommand(obj.x, obj.y);
        return;
      }
    }
    if (this.selected) this.issueMoveCommand(pointer.worldX, pointer.worldY);
  }

  private issueMoveCommand(x: number, y: number) {
    if (!this.selected) return;
    const u = this.units.get(this.selected);
    if (!u || u.owner !== 0) {
      this.selected = null;
      return;
    }
    u.manualTarget = { x: Phaser.Math.Clamp(x, 10, FFA_WORLD_W - 10), y: Phaser.Math.Clamp(y, 10, FFA_WORLD_H - 10) };
  }

  update(time: number, delta: number) {
    if (this.gameOver || this.paused) return;
    const dt = delta / 1000;

    for (const base of this.bases) {
      if (base.owner === 0 || !base.alive) continue;
      if (this.units.size > 400) break; // an toàn, tránh nổ bộ nhớ nếu treo lâu
      if (time - base.lastSpawnAt >= base.spawnEveryMs) {
        const count = Array.from(this.units.values()).filter((u) => u.owner === base.owner && u.state !== "dead").length;
        const affordable = FFA_UNIT_TYPES.filter((t) => UNIT_CONFIGS[t].cost <= base.gold);
        if (count < FFA_BOT_POP_CAP && affordable.length) {
          const type = affordable[Math.floor(Math.random() * affordable.length)];
          base.gold -= UNIT_CONFIGS[type].cost;
          this.spawnUnit(base.owner, base.color, type, base.x + Phaser.Math.Between(-30, 30), base.y + Phaser.Math.Between(20, 50));
        }
        base.lastSpawnAt = time;
      }
    }

    for (const u of this.units.values()) {
      if (u.state === "dead") continue;
      const cfg = UNIT_CONFIGS[u.type];

      let nearest: FfaUnit | null = null;
      let nearestDist = Infinity;
      for (const other of this.units.values()) {
        if (other.state === "dead") continue;
        const opposing = u.owner === 0 ? other.owner !== 0 : other.owner === 0;
        if (!opposing) continue;
        const d = Phaser.Math.Distance.Between(u.x, u.y, other.x, other.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = other;
        }
      }

      let nearestBase: FfaBase | null = null;
      let nearestBaseDist = Infinity;
      for (const b of this.bases) {
        if (!b.alive) continue;
        const opposing = u.owner === 0 ? b.owner !== 0 : b.owner === 0;
        if (!opposing) continue;
        const d = Phaser.Math.Distance.Between(u.x, u.y, b.x, b.y);
        if (d < nearestBaseDist) {
          nearestBaseDist = d;
          nearestBase = b;
        }
      }

      const canHitUnit = !!nearest && nearestDist <= cfg.range;
      const canHitBase = !canHitUnit && !!nearestBase && nearestBaseDist <= Math.max(cfg.range, BASE_HIT_RADIUS);

      if (canHitUnit || canHitBase) {
        u.state = "attack";
        if (u.lastAnimState !== "attack") {
          u.lastAnimState = "attack";
          u.sprite.play(`${u.spriteKey}_attack-anim`);
        }
        if (time - u.lastAttackAt >= cfg.attackCooldownMs) {
          u.lastAttackAt = time;
          u.sprite.play(`${u.spriteKey}_attack-anim`);
          if (canHitUnit && nearest) this.applyDamageToUnit(nearest.id, cfg.damage);
          else if (canHitBase && nearestBase) this.applyDamageToBase(nearestBase, cfg.damage);
        }
      } else {
        u.state = "walk";
        if (u.lastAnimState !== "walk") {
          u.lastAnimState = "walk";
          u.sprite.play(`${u.spriteKey}_run-anim`, true);
        }
        let tx = u.x;
        let ty = u.y;
        if (u.owner === 0) {
          if (u.manualTarget) {
            tx = u.manualTarget.x;
            ty = u.manualTarget.y;
          }
        } else {
          const human = this.bases[0];
          tx = human.x;
          ty = human.y;
        }
        const dx = tx - u.x;
        const dy = ty - u.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const step = cfg.speed * dt;
        if (u.owner === 0 && u.manualTarget && d <= step) {
          u.x = tx;
          u.y = ty;
          u.manualTarget = null;
        } else if (d > 1) {
          u.x += (dx / d) * Math.min(step, d);
          u.y += (dy / d) * Math.min(step, d);
          u.sprite.setFlipX(dx < 0);
        }
        u.x = Phaser.Math.Clamp(u.x, 10, FFA_WORLD_W - 10);
        u.y = Phaser.Math.Clamp(u.y, 10, FFA_WORLD_H - 10);
      }

      u.sprite.setPosition(u.x, u.y);
      u.sprite.setDepth(10 + u.y / 10000);
      this.drawHpBar(u.hpBar, u.x, u.y - 32, u.hp, u.maxHp, 28);
    }

    // Tháp canh mọi base tự bắn quân đối phương trong tầm
    for (const base of this.bases) {
      if (!base.alive) continue;
      let target: FfaUnit | null = null;
      let dist = Infinity;
      for (const u of this.units.values()) {
        if (u.state === "dead") continue;
        const opposing = base.owner === 0 ? u.owner !== 0 : u.owner === 0;
        if (!opposing) continue;
        const d = Phaser.Math.Distance.Between(base.towerPos.x, base.towerPos.y, u.x, u.y);
        if (d < dist) {
          dist = d;
          target = u;
        }
      }
      if (target && dist <= TOWER_RANGE && time - base.towerLastAttackAt >= TOWER_COOLDOWN_MS) {
        base.towerLastAttackAt = time;
        this.applyDamageToUnit(target.id, TOWER_DAMAGE);
      }
      this.drawHpBar(base.hpBar, base.x, base.y - 78, base.hp, base.maxHp, 80);
    }

    this.drawSelectionRing();
    this.drawMinimap();
    this.emitHud();
  }

  private applyDamageToUnit(id: string, damage: number) {
    const u = this.units.get(id);
    if (!u || u.state === "dead") return;
    u.hp = Math.max(0, u.hp - damage);
    u.sprite.setTintFill(0xff6666);
    this.time.delayedCall(80, () => u.sprite.clearTint());
    if (u.hp <= 0) {
      u.state = "dead";
      u.sprite.destroy();
      u.hpBar.destroy();
      this.units.delete(id);
      if (this.selected === id) this.selected = null;
    }
  }

  private applyDamageToBase(base: FfaBase, damage: number) {
    if (!base.alive) return;
    base.hp = Math.max(0, base.hp - damage);
    if (base.hp <= 0) {
      base.alive = false;
      base.castle.setTintFill(0x555555);
      if (base.owner === 0) this.endGame(false);
      else if (this.bases.slice(1).every((b) => !b.alive)) this.endGame(true);
    }
  }

  private drawSelectionRing() {
    this.selectionRing.clear();
    if (!this.selected) return;
    const u = this.units.get(this.selected);
    if (!u) {
      this.selected = null;
      return;
    }
    this.selectionRing.lineStyle(2, 0xffffff, 0.85);
    this.selectionRing.strokeEllipse(u.x, u.y, 32, 16);
  }

  private drawMinimap() {
    const g = this.minimapG;
    g.clear();
    const mmW = 140;
    const mmH = 100;
    const pad = 10;
    const mmX = FFA_WORLD_W - mmW - pad;
    const mmY = pad;
    g.fillStyle(0x1a2e1a, 0.75);
    g.fillRoundedRect(mmX, mmY, mmW, mmH, 6);
    g.lineStyle(1.5, 0xe9dcbb, 0.6);
    g.strokeRoundedRect(mmX, mmY, mmW, mmH, 6);
    const sx = (mmW - 8) / FFA_WORLD_W;
    const sy = (mmH - 8) / FFA_WORLD_H;
    const toX = (x: number) => mmX + 4 + x * sx;
    const toY = (y: number) => mmY + 4 + y * sy;
    for (const b of this.bases) {
      if (!b.alive) continue;
      g.fillStyle(FACTION_HEX[b.color], 1);
      g.fillRect(toX(b.x) - 3, toY(b.y) - 3, 6, 6);
    }
    for (const u of this.units.values()) {
      g.fillStyle(FACTION_HEX[this.bases[u.owner]?.color ?? this.playerColor], 1);
      g.fillCircle(toX(u.x), toY(u.y), 1.4);
    }
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, hp: number, maxHp: number, width: number) {
    g.clear();
    const h = 6;
    const pct = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    g.fillStyle(0x000000, 0.5);
    g.fillRect(x - width / 2 - 1, y - 1, width + 2, h + 2);
    g.fillStyle(pct > 0.5 ? 0x4ade80 : pct > 0.2 ? 0xfacc15 : 0xef4444, 1);
    g.fillRect(x - width / 2, y, width * pct, h);
  }

  private emitHud() {
    const myUnits = Array.from(this.units.values()).filter((u) => u.owner === 0 && u.state !== "dead").length;
    gameEvents.emit("ffa-hud-update", {
      gold: this.gold,
      myUnits,
      popCap: FFA_POP_CAP,
      myBaseHp: this.bases[0]?.hp ?? 0,
      myBaseMaxHp: FFA_BASE_MAX_HP,
      enemyBases: this.bases.slice(1).map((b) => ({ color: b.color, hp: b.hp, maxHp: b.maxHp, alive: b.alive })),
    });
  }

  private endGame(youWin: boolean) {
    if (this.gameOver) return;
    this.gameOver = true;
    gameEvents.emit("game-end", { youWin });
  }
}
