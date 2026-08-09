import Phaser from "phaser";
import {
  OpponentLink,
  RoomSync,
  Side,
  StatePayload,
  UnitSnapshot,
} from "@/game/net";
import { BotOpponent } from "@/game/opponent";
import {
  BASE_MAX_HP,
  BASE_POP_CAP,
  BUILDING_VISUALS,
  FRAME_SIZE,
  GOLD_INCOME_PER_SEC,
  MAP_PRESETS,
  MapPreset,
  MapSize,
  POP_CAP_PER_BUILDING,
  STARTING_GOLD,
  TOWER_COOLDOWN_MS,
  TOWER_DAMAGE,
  TOWER_RANGE,
  UNIT_CONFIGS,
  UnitType,
  animFrameRange,
  UNIT_ANIM,
} from "@/game/entities";
import { gameEvents } from "@/game/events";

const BASE_HIT_RADIUS = 70;
const STATE_BROADCAST_MS = 130;

interface LocalUnit {
  id: string;
  type: UnitType;
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
}

interface RemoteUnit {
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
  targetX: number;
  y: number;
  hp: number;
  maxHp: number;
  type: UnitType;
  spriteKey: string;
  lastAnimState: "walk" | "attack" | "dead";
}

export default class MainScene extends Phaser.Scene {
  private roomCode!: string;
  private isHost!: boolean;
  private mode!: "bot" | "online";
  private preset!: MapPreset;

  private sync!: OpponentLink;
  private mySide: Side = "left";
  private opponentConnected = false;
  private gameOver = false;

  private gold = STARTING_GOLD;
  private myBaseHp = BASE_MAX_HP;
  private enemyBaseHp = BASE_MAX_HP;
  private popCap = BASE_POP_CAP;

  private myCastle!: Phaser.GameObjects.Image;
  private enemyCastle!: Phaser.GameObjects.Image;
  private myBaseBar!: Phaser.GameObjects.Graphics;
  private enemyBaseBar!: Phaser.GameObjects.Graphics;

  private myTowerPos: { x: number; y: number } | null = null;
  private towerLastAttackAt = 0;

  private localUnits = new Map<string, LocalUnit>();
  private remoteUnits = new Map<string, RemoteUnit>();
  private lastBroadcastAt = 0;
  private unitCounter = 0;

  constructor() {
    super("MainScene");
  }

  init(data: { roomCode: string; isHost: boolean; mode: "bot" | "online"; mapSize: MapSize }) {
    this.roomCode = data.roomCode;
    this.isHost = data.isHost;
    this.mode = data.mode;
    this.preset = MAP_PRESETS[data.mapSize] ?? MAP_PRESETS.medium;
    this.popCap = BASE_POP_CAP + this.preset.buildings.length * POP_CAP_PER_BUILDING;
  }

  preload() {
    this.load.image("grass_tile", "/assets/terrain/grass_tile.png");
    this.load.image("grass_tile_small", "/assets/terrain/grass_tile_small.png");
    this.load.image("grass_tile_large", "/assets/terrain/grass_tile_large.png");
    this.load.image("tree_a", "/assets/terrain/tree_a.png");
    this.load.image("tree_b", "/assets/terrain/tree_b.png");
    this.load.image("tree_c", "/assets/terrain/tree_c.png");
    this.load.image("deco_bush", "/assets/terrain/deco/bush.png");
    this.load.image("deco_bush2", "/assets/terrain/deco/bush2.png");
    this.load.image("deco_rock", "/assets/terrain/deco/rock.png");
    this.load.image("deco_mushroom", "/assets/terrain/deco/mushroom.png");
    this.load.image("goldmine", "/assets/ui/GoldMine_Active.png");
    this.load.image("banner", "/assets/ui/Banner_Vertical.png");

    this.load.image("castle_blue", "/assets/buildings/Castle_Blue.png");
    this.load.image("castle_red", "/assets/buildings/Castle_Red.png");
    for (const b of BUILDING_VISUALS) {
      this.load.image(`bld_${b.key}_blue`, `/assets/buildings/${b.file}_Blue.png`);
      this.load.image(`bld_${b.key}_red`, `/assets/buildings/${b.file}_Red.png`);
    }

    this.load.spritesheet("pawn_blue", "/assets/units/Pawn_Blue.png", {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
    });
    this.load.spritesheet("pawn_red", "/assets/units/Pawn_Red.png", {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
    });
    this.load.spritesheet("warrior_blue", "/assets/units/Warrior_Blue.png", {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
    });
    this.load.spritesheet("warrior_red", "/assets/units/Warrior_Red.png", {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
    });
    this.load.spritesheet("archer_blue", "/assets/units/Archer_Blue.png", {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
    });
    this.load.spritesheet("archer_red", "/assets/units/Archer_Red.png", {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
    });
  }

  create() {
    this.createAnimations();
    this.buildMap();

    this.myCastle = this.add.image(0, 0, "castle_blue").setScale(0.5).setDepth(5);
    this.enemyCastle = this.add.image(0, 0, "castle_red").setScale(0.5).setDepth(5);
    this.myBaseBar = this.add.graphics().setDepth(6);
    this.enemyBaseBar = this.add.graphics().setDepth(6);

    gameEvents.on("spawn-unit", this.handleSpawnRequest, this);
    gameEvents.on("leave-room", this.handleLeave, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameEvents.off("spawn-unit", this.handleSpawnRequest, this);
      gameEvents.off("leave-room", this.handleLeave, this);
      this.sync?.disconnect();
    });

    this.connectRoom();
    this.emitHud();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.gameOver) return;
        this.gold += GOLD_INCOME_PER_SEC;
        this.emitHud();
      },
    });
  }

  private async connectRoom() {
    this.sync =
      this.mode === "bot" ? new BotOpponent(this.preset) : new RoomSync(this.roomCode, this.isHost);

    this.sync.on({
      onState: (p) => this.applyRemoteState(p),
      onHit: (p) => this.applyIncomingHit(p.targetId, p.damage),
      onGameOver: (p) => this.endGame(p.loserSide === this.mySide),
      onOpponentJoined: () => {
        this.opponentConnected = true;
        this.emitHud();
      },
      onOpponentLeft: () => {
        this.opponentConnected = false;
        this.emitHud();
      },
    });
    const side = await this.sync.connect();
    this.mySide = side;
    this.opponentConnected = this.mode === "bot" ? true : this.opponentConnected;
    this.layoutBases();
    this.emitHud();
  }

  private layoutBases() {
    const myX = this.mySide === "left" ? this.preset.baseMargin : this.preset.worldW - this.preset.baseMargin;
    const enemyX = this.mySide === "left" ? this.preset.worldW - this.preset.baseMargin : this.preset.baseMargin;
    const midY = this.preset.worldH / 2;
    this.myCastle.setPosition(myX, midY);
    this.enemyCastle.setPosition(enemyX, midY);
    this.enemyCastle.setFlipX(this.mySide === "right");
    this.myCastle.setFlipX(this.mySide === "left");

    // Vùng lãnh thổ mờ dưới chân base
    const territory = this.add.graphics().setDepth(1);
    territory.fillStyle(0x3b82f6, 0.12);
    territory.fillEllipse(myX, midY + 10, 300, 190);
    territory.fillStyle(0xef4444, 0.12);
    territory.fillEllipse(enemyX, midY + 10, 300, 190);

    // Bóng đổ dưới base
    const shadow = this.add.graphics().setDepth(4);
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillEllipse(myX, midY + 70, 130, 24);
    shadow.fillEllipse(enemyX, midY + 70, 130, 24);

    // Cờ hiệu 2 bên base
    const dirMine = this.mySide === "left" ? -1 : 1;
    const dirEnemy = -dirMine;
    const myFlag = this.add.image(myX + dirMine * 95, midY - 40, "banner").setScale(0.35).setDepth(5);
    myFlag.setTint(0x60a5fa);
    const enemyFlag = this.add.image(enemyX + dirEnemy * 95, midY - 40, "banner").setScale(0.35).setDepth(5);
    enemyFlag.setTint(0xf87171);

    // Mỏ vàng trang trí sau base
    this.add.image(myX, midY + 95, "goldmine").setScale(0.5).setDepth(4);
    this.add.image(enemyX, midY + 95, "goldmine").setScale(0.5).setDepth(4);

    // Cụm công trình quanh base — quyết định bởi kích thước bản đồ
    for (const b of this.preset.buildings) {
      const visual = BUILDING_VISUALS.find((v) => v.key === b);
      if (!visual) continue;
      const myBx = myX + dirMine * visual.offsetX;
      const enemyBx = enemyX + dirEnemy * visual.offsetX;
      const by = midY + visual.offsetY;
      this.add.image(myBx, by, `bld_${b}_blue`).setScale(visual.scale).setDepth(4);
      this.add.image(enemyBx, by, `bld_${b}_red`).setScale(visual.scale).setDepth(4);

      if (b === "tower") {
        this.myTowerPos = { x: myBx, y: by };
      }
    }
  }

  private createAnimations() {
    const colors: Array<"blue" | "red"> = ["blue", "red"];
    const types: UnitType[] = ["pawn", "warrior", "archer"];
    for (const type of types) {
      for (const color of colors) {
        const key = `${type}_${color}`;
        (["idle", "walk", "attack"] as const).forEach((kind) => {
          const { start, end } = animFrameRange(type, kind);
          const animKey = `${key}-${kind}`;
          if (this.anims.exists(animKey)) return;
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(key, { start, end }),
            frameRate: UNIT_ANIM[type].frameRate,
            repeat: kind === "attack" ? 0 : -1,
          });
        });
      }
    }
  }

  private buildMap() {
    const { worldW, worldH, laneYMin, laneYMax, grassTexture, treeSpacing } = this.preset;
    this.cameras.main.setBackgroundColor("#2f4d2a");

    const bg = this.add.tileSprite(0, 0, worldW, worldH, grassTexture).setOrigin(0, 0).setDepth(0);
    bg.setTileScale(0.9, 0.9);

    const field = this.add.graphics().setDepth(0);
    field.fillStyle(0x000000, 0.08);
    field.fillRect(0, 0, worldW, laneYMin - 40);
    field.fillRect(0, laneYMax + 40, worldW, worldH - (laneYMax + 40));

    const midLine = this.add.graphics().setDepth(2);
    midLine.lineStyle(3, 0xffffff, 0.2);
    midLine.lineBetween(worldW / 2, 40, worldW / 2, worldH - 40);
    for (let y = 20; y < worldH - 10; y += 26) {
      midLine.fillStyle(0xffffff, 0.12);
      midLine.fillCircle(worldW / 2, y, 3);
    }

    const treeKeys = ["tree_a", "tree_b", "tree_c"];
    const topY = 18;
    const bottomY = worldH - 8;
    let i = 0;
    for (let x = -10; x < worldW + 40; x += treeSpacing) {
      const key = treeKeys[i % treeKeys.length];
      const jitter = i % 2 === 0 ? -6 : 6;
      this.add.image(x, topY + jitter, key).setScale(0.42).setDepth(3).setOrigin(0.5, 0.85);
      this.add
        .image(x + treeSpacing / 2, bottomY + jitter, key)
        .setScale(0.42)
        .setDepth(3)
        .setFlipY(true)
        .setOrigin(0.5, 0.15);
      i++;
    }

    const decoKeys = ["deco_bush", "deco_bush2", "deco_rock", "deco_mushroom"];
    let d = 0;
    for (let x = 140; x < worldW - 100; x += 170) {
      const key = decoKeys[d % decoKeys.length];
      this.add.image(x, laneYMin - 55, key).setScale(0.6).setDepth(3).setAlpha(0.9);
      this.add.image(x + 70, laneYMax + 45, decoKeys[(d + 1) % decoKeys.length]).setScale(0.6).setDepth(3).setAlpha(0.9);
      d++;
    }
  }

  // ── Spawn ──────────────────────────────────────────────────────────
  private handleSpawnRequest(type: UnitType) {
    if (this.gameOver || !this.opponentConnected) return;
    if (this.localUnits.size >= this.popCap) return;
    const cfg = UNIT_CONFIGS[type];
    if (this.gold < cfg.cost) return;
    this.gold -= cfg.cost;
    this.emitHud();

    const id = `${this.sync.playerId}-${this.unitCounter++}`;
    const startX = this.mySide === "left" ? this.preset.baseMargin + 60 : this.preset.worldW - this.preset.baseMargin - 60;
    const y = Phaser.Math.Between(this.preset.laneYMin, this.preset.laneYMax);
    const spriteKey = `${type}_${this.mySide === "left" ? "blue" : "red"}`;
    const sprite = this.add.sprite(startX, y, spriteKey, 0).setScale(0.4).setDepth(10);
    sprite.setFlipX(this.mySide === "right");
    sprite.play(`${spriteKey}-walk`);
    sprite.setScale(0);
    this.tweens.add({ targets: sprite, scale: 0.4, duration: 220, ease: "Back.Out" });
    const hpBar = this.add.graphics().setDepth(11);

    this.localUnits.set(id, {
      id,
      type,
      spriteKey,
      sprite,
      hpBar,
      x: startX,
      y,
      hp: cfg.hp,
      maxHp: cfg.hp,
      state: "walk",
      lastAnimState: "walk",
      lastAttackAt: 0,
    });
  }

  // ── Nhận trạng thái/đòn đánh từ đối thủ ─────────────────────────────
  private applyRemoteState(p: StatePayload) {
    this.enemyBaseHp = p.baseHp;
    const seen = new Set<string>();
    for (const u of p.units) {
      seen.add(u.id);
      let ru = this.remoteUnits.get(u.id);
      if (!ru && u.hp > 0) {
        const spriteKey = `${u.type}_${p.side === "left" ? "blue" : "red"}`;
        const sprite = this.add.sprite(u.x, this.laneYForRemote(u.id), spriteKey, 0).setScale(0.4).setDepth(10);
        sprite.setFlipX(p.side === "right");
        sprite.play(`${spriteKey}-walk`);
        const hpBar = this.add.graphics().setDepth(11);
        ru = { sprite, hpBar, targetX: u.x, y: sprite.y, hp: u.hp, maxHp: u.maxHp, type: u.type, spriteKey, lastAnimState: "walk" };
        this.remoteUnits.set(u.id, ru);
      }
      if (ru) {
        ru.targetX = u.x;
        ru.hp = u.hp;
        ru.maxHp = u.maxHp;
        if (u.state !== ru.lastAnimState) {
          ru.lastAnimState = u.state;
          if (u.state === "attack") ru.sprite.play(`${ru.spriteKey}-attack`);
          else if (u.state === "walk") ru.sprite.play(`${ru.spriteKey}-walk`, true);
        }
        if (u.hp <= 0) this.destroyRemoteUnit(u.id);
      }
    }
    for (const id of Array.from(this.remoteUnits.keys())) {
      if (!seen.has(id)) this.destroyRemoteUnit(id);
    }
  }

  private laneYForRemote(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return this.preset.laneYMin + (hash % (this.preset.laneYMax - this.preset.laneYMin));
  }

  private destroyRemoteUnit(id: string) {
    const ru = this.remoteUnits.get(id);
    if (!ru) return;
    ru.sprite.destroy();
    ru.hpBar.destroy();
    this.remoteUnits.delete(id);
  }

  private applyIncomingHit(targetId: string, damage: number) {
    if (this.gameOver) return;
    if (targetId === "base") {
      this.myBaseHp = Math.max(0, this.myBaseHp - damage);
      this.emitHud();
      if (this.myBaseHp <= 0) {
        this.sync.sendGameOver(this.mySide);
        this.endGame(false);
      }
      return;
    }
    const u = this.localUnits.get(targetId);
    if (!u || u.state === "dead") return;
    u.hp = Math.max(0, u.hp - damage);
    u.sprite.setTintFill(0xff6666);
    this.time.delayedCall(80, () => u.sprite.clearTint());
    if (u.hp <= 0) {
      u.state = "dead";
      u.sprite.destroy();
      u.hpBar.destroy();
      this.localUnits.delete(targetId);
      this.emitHud();
    }
  }

  update(time: number, delta: number) {
    if (this.gameOver) return;
    const dt = delta / 1000;
    const dir = this.mySide === "left" ? 1 : -1;
    const enemyBaseX = this.mySide === "left" ? this.preset.worldW - this.preset.baseMargin : this.preset.baseMargin;

    for (const u of this.localUnits.values()) {
      if (u.state === "dead") continue;
      const cfg = UNIT_CONFIGS[u.type];

      let nearestId: string | null = null;
      let nearestDist = Infinity;
      for (const [rid, ru] of this.remoteUnits) {
        const d = Math.abs(ru.sprite.x - u.x);
        if (d < nearestDist) {
          nearestDist = d;
          nearestId = rid;
        }
      }
      const distToBase = Math.abs(enemyBaseX - u.x);

      const canHitUnit = nearestId !== null && nearestDist <= cfg.range;
      const canHitBase = !canHitUnit && distToBase <= Math.max(cfg.range, BASE_HIT_RADIUS);

      if (canHitUnit || canHitBase) {
        u.state = "attack";
        if (u.lastAnimState !== "attack") {
          u.lastAnimState = "attack";
          u.sprite.play(`${u.spriteKey}-attack`);
        }
        if (time - u.lastAttackAt >= cfg.attackCooldownMs) {
          u.lastAttackAt = time;
          u.sprite.play(`${u.spriteKey}-attack`);
          if (canHitUnit && nearestId) {
            this.sync.sendHit(nearestId, cfg.damage);
          } else if (canHitBase) {
            this.sync.sendHit("base", cfg.damage);
          }
        }
      } else {
        u.state = "walk";
        if (u.lastAnimState !== "walk") {
          u.lastAnimState = "walk";
          u.sprite.play(`${u.spriteKey}-walk`, true);
        }
        u.x += dir * cfg.speed * dt;
        u.x = Phaser.Math.Clamp(u.x, this.preset.baseMargin, this.preset.worldW - this.preset.baseMargin);
      }

      u.sprite.setPosition(u.x, u.y);
      u.sprite.setDepth(10 + u.y / 1000);
      this.drawHpBar(u.hpBar, u.x, u.y - 34, u.hp, u.maxHp, 30);
    }

    for (const ru of this.remoteUnits.values()) {
      ru.sprite.x = Phaser.Math.Linear(ru.sprite.x, ru.targetX, Math.min(1, dt * 6));
      this.drawHpBar(ru.hpBar, ru.sprite.x, ru.sprite.y - 34, ru.hp, ru.maxHp, 30);
    }

    // Tháp canh của mình tự bắn quân địch trong tầm
    if (this.myTowerPos) {
      let nearestId: string | null = null;
      let nearestDist = Infinity;
      for (const [rid, ru] of this.remoteUnits) {
        const d = Phaser.Math.Distance.Between(this.myTowerPos.x, this.myTowerPos.y, ru.sprite.x, ru.sprite.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestId = rid;
        }
      }
      if (nearestId && nearestDist <= TOWER_RANGE && time - this.towerLastAttackAt >= TOWER_COOLDOWN_MS) {
        this.towerLastAttackAt = time;
        this.sync.sendHit(nearestId, TOWER_DAMAGE);
        const target = this.remoteUnits.get(nearestId);
        if (target) this.drawTowerShot(this.myTowerPos.x, this.myTowerPos.y, target.sprite.x, target.sprite.y);
      }
    }

    this.drawHpBar(this.myBaseBar, this.myCastle.x, this.myCastle.y - 90, this.myBaseHp, BASE_MAX_HP, 90);
    this.drawHpBar(this.enemyBaseBar, this.enemyCastle.x, this.enemyCastle.y - 90, this.enemyBaseHp, BASE_MAX_HP, 90);

    if (time - this.lastBroadcastAt >= STATE_BROADCAST_MS) {
      this.lastBroadcastAt = time;
      this.broadcastState();
    }
  }

  private drawTowerShot(x1: number, y1: number, x2: number, y2: number) {
    const line = this.add.graphics().setDepth(20);
    line.lineStyle(2, 0xfff3b0, 0.9);
    line.lineBetween(x1, y1, x2, y2);
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 220,
      onComplete: () => line.destroy(),
    });
  }

  private broadcastState() {
    const units: UnitSnapshot[] = Array.from(this.localUnits.values()).map((u) => ({
      id: u.id,
      type: u.type,
      x: u.x,
      hp: u.hp,
      maxHp: u.maxHp,
      state: u.state,
    }));
    this.sync.sendState({ side: this.mySide, baseHp: this.myBaseHp, gold: this.gold, units });
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
    gameEvents.emit("hud-update", {
      gold: this.gold,
      myBaseHp: this.myBaseHp,
      myBaseMaxHp: BASE_MAX_HP,
      enemyBaseHp: this.enemyBaseHp,
      enemyBaseMaxHp: BASE_MAX_HP,
      opponentConnected: this.opponentConnected,
      myUnits: this.localUnits.size,
      popCap: this.popCap,
    });
  }

  private endGame(youWin: boolean) {
    if (this.gameOver) return;
    this.gameOver = true;
    gameEvents.emit("game-end", { youWin });
  }

  private handleLeave() {
    this.sync?.disconnect();
  }
}
