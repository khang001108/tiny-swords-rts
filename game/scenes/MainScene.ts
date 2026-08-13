import Phaser from "phaser";
import {
  OpponentLink,
  RoomSync,
  Side,
  StatePayload,
  UnitSnapshot,
} from "@/game/net";
import { BotOpponent } from "@/game/opponent";
import { NavGrid, buildNavGrid, findPath } from "@/game/pathfinding";
import {
  BASE_MAX_HP,
  BUILDING_VISUALS,
  CLOUD_KEYS,
  FRAME_SIZE,
  FX_DUST_FRAMES,
  FX_EXPLOSION_FRAMES,
  GOLD_INCOME_PER_SEC,
  HOUSE_COST,
  HOUSE_MAX_COUNT,
  HOUSE_POP_BONUS,
  HOUSE_VILLAGER_BONUS,
  RESOURCE_HOUSE_COST,
  RESOURCE_NODE_MAX_HP,
  RESOURCE_HOUSE_POP_BONUS,
  MAP_PRESETS,
  MapPreset,
  MapId,
  WaterBand,
  computePopCap,
  RESOURCE_NODE_LAYOUT,
  ResourceKind,
  RESOURCE_LABEL,
  STARTING_GOLD,
  TOWER_COOLDOWN_MS,
  TOWER_DAMAGE,
  TOWER_RANGE,
  UNIT_CONFIGS,
  UNIT_PERACTION_FRAMES,
  UNIT_SPRITE_MODE,
  UnitType,
  VILLAGER_COST,
  VILLAGER_MAX_COUNT,
  animFrameRange,
  UNIT_ANIM,
} from "@/game/entities";
import { gameEvents } from "@/game/events";
import { NodePositions, VillagerSystem, createVillagerAnimations } from "@/game/villager";

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
  manualTarget: { x: number; y: number } | null;
  path: { x: number; y: number }[] | null;
  pathIndex: number;
  pathTargetKey: string;
}

interface RemoteUnit {
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
  targetX: number;
  targetY: number;
  hp: number;
  maxHp: number;
  type: UnitType;
  spriteKey: string;
  lastAnimState: "walk" | "attack" | "dead";
}

export default class MainScene extends Phaser.Scene {
  private roomCode!: string;
  private isHost!: boolean;
  private mode!: "bot" | "online" | "endless";
  private preset!: MapPreset;

  private sync!: OpponentLink;
  private mySide: Side = "left";
  private opponentConnected = false;
  private gameOver = false;

  private gold = STARTING_GOLD;
  private wood = 0;
  private meat = 0;
  private myBaseHp = BASE_MAX_HP;
  private enemyBaseHp = BASE_MAX_HP;
  private popCap = 6;

  private myVillagers: VillagerSystem | null = null;
  private myBasePos = { x: 0, y: 0 };
  private enemyBasePos = { x: 0, y: 0 };
  /** Dấu lệch cụm công trình/tài nguyên của base MÌNH — đọc từ BaseSpec do map tự chọn, không
   *  còn suy từ mySide==="left" (2 base không cần đối xứng nhau nữa). */
  private myFacingDir: 1 | -1 = -1;
  private myNodePosSaved: NodePositions | null = null;
  private housesBuilt = 0;
  private resourceHouses: Record<ResourceKind, boolean> = { wood: false, gold: false, meat: false };
  private buildMode: { type: "house" } | { type: "resource"; kind: ResourceKind } | null = null;
  private ghostSprite: Phaser.GameObjects.Image | null = null;
  private myBuildingPositions: { x: number; y: number }[] = [];
  private enemyBuildingPositions: { x: number; y: number }[] = [];
  private woodNodeSprites: Phaser.GameObjects.Sprite[] = [];
  private goldNodeSprite: Phaser.GameObjects.Image | null = null;
  private woodNodePos: { x: number; y: number } | null = null;
  private goldNodePos: { x: number; y: number } | null = null;
  private resourceNodeHp: Partial<Record<ResourceKind, number>> = {};
  private resourceDepleted: Record<ResourceKind, boolean> = { wood: false, gold: false, meat: false };
  private neutralGoldSprite: Phaser.GameObjects.Image | null = null;
  private neutralGoldHp = 0;
  private neutralGoldDepleted = false;
  private paused = false;
  private currentWave = 1;
  private matchStartMs = 0;

  private myCastle!: Phaser.GameObjects.Image;
  private enemyCastle!: Phaser.GameObjects.Image;
  private myBaseBar!: Phaser.GameObjects.Graphics;
  private enemyBaseBar!: Phaser.GameObjects.Graphics;

  private myTowerPos: { x: number; y: number } | null = null;
  private towerLastAttackAt = 0;

  private selected: { kind: "unit" | "villager"; id: string }[] = [];
  private selectionRing!: Phaser.GameObjects.Graphics;
  private buildingRing!: Phaser.GameObjects.Graphics;
  private selectedBuildingPos: { x: number; y: number } | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private dragStartScreen: { x: number; y: number } | null = null;
  private isDragging = false;
  private isPanning = false;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private minZoom = 1;
  private maxZoom = 3;
  private dragBoxG!: Phaser.GameObjects.Graphics;
  private myResourceNodes: { kind: ResourceKind; x: number; y: number; obj: Phaser.GameObjects.GameObject }[] = [];

  private waterBands: WaterBand[] = [];
  private hillObstacles: { x: number; y: number; r: number }[] = [];
  private hillPlateaus: { x: number; y: number; r: number }[] = [];
  private navGrid: NavGrid | null = null;

  private localUnits = new Map<string, LocalUnit>();
  private remoteUnits = new Map<string, RemoteUnit>();
  private lastBroadcastAt = 0;
  private lastMinimapEmitAt = 0;
  private unitCounter = 0;

  constructor() {
    super("MainScene");
  }

  init(data: { roomCode: string; isHost: boolean; mode: "bot" | "online" | "endless"; mapId: MapId }) {
    this.roomCode = data.roomCode;
    this.isHost = data.isHost;
    this.mode = data.mode;
    this.preset = MAP_PRESETS[data.mapId] ?? MAP_PRESETS.classic;
    this.popCap = computePopCap(this.preset.buildings.length, 0, 0);
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
    this.load.image("hill", "/assets/terrain/hill.png");
    this.load.image("islet_flat", "/assets/terrain/islet_flat.png");
    this.load.image("islet_cliff", "/assets/terrain/islet_cliff.png");
    this.load.image("water_tile", "/assets/terrain/water_tile.png");
    this.load.image("cloud1", "/assets/terrain/clouds/cloud1.png");
    this.load.image("cloud2", "/assets/terrain/clouds/cloud2.png");
    this.load.image("cloud3", "/assets/terrain/clouds/cloud3.png");

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

    // Lính nâng cấp (Warrior/Archer) — mỗi hành động là 1 file riêng (bộ sprite mới)
    const perActionColors: Array<"blue" | "red"> = ["blue", "red"];
    for (const color of perActionColors) {
      this.load.spritesheet(`warrior_${color}_idle`, `/assets/units2/warrior_${color}_idle.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
      this.load.spritesheet(`warrior_${color}_run`, `/assets/units2/warrior_${color}_run.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
      this.load.spritesheet(`warrior_${color}_attack`, `/assets/units2/warrior_${color}_attack.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
      this.load.spritesheet(`archer_${color}_idle`, `/assets/units2/archer_${color}_idle.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
      this.load.spritesheet(`archer_${color}_run`, `/assets/units2/archer_${color}_run.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
      this.load.spritesheet(`archer_${color}_attack`, `/assets/units2/archer_${color}_attack.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
      this.load.spritesheet(`monk_${color}_idle`, `/assets/units2/monk_${color}_idle.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
      this.load.spritesheet(`monk_${color}_run`, `/assets/units2/monk_${color}_run.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
      this.load.spritesheet(`monk_${color}_attack`, `/assets/units2/monk_${color}_attack.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });

      // Dân (villager) — chạy tay không theo dụng cụ, khai thác, rồi chạy về mang tài nguyên
      this.load.spritesheet(`vill_${color}_idle`, `/assets/villager/${color}_idle.png`, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE,
      });
      (["wood", "gold", "meat"] as ResourceKind[]).forEach((kind) => {
        this.load.spritesheet(`vill_${color}_run_${kind}`, `/assets/villager/${color}_run_${kind}.png`, {
          frameWidth: FRAME_SIZE,
          frameHeight: FRAME_SIZE,
        });
        this.load.spritesheet(`vill_${color}_interact_${kind}`, `/assets/villager/${color}_interact_${kind}.png`, {
          frameWidth: FRAME_SIZE,
          frameHeight: FRAME_SIZE,
        });
        this.load.spritesheet(`vill_${color}_carry_${kind}`, `/assets/villager/${color}_carry_${kind}.png`, {
          frameWidth: FRAME_SIZE,
          frameHeight: FRAME_SIZE,
        });
      });
    }

    // Mỏ tài nguyên
    this.load.image("res_gold", "/assets/resources/gold_node.png");
    this.load.image("res_gold_75", "/assets/resources/gold_75.png");
    this.load.image("res_gold_40", "/assets/resources/gold_40.png");
    this.load.image("res_gold_15", "/assets/resources/gold_15.png");
    this.load.image("res_stump", "/assets/resources/stump.png");
    this.load.spritesheet("res_tree1", "/assets/resources/tree1_sheet.png", { frameWidth: 192, frameHeight: 256 });
    this.load.spritesheet("res_tree2", "/assets/resources/tree2_sheet.png", { frameWidth: 192, frameHeight: 256 });
    this.load.spritesheet("res_sheep", "/assets/resources/sheep_sheet.png", { frameWidth: 128, frameHeight: 128 });

    // Hiệu ứng cháy nổ / bụi khi chết
    this.load.spritesheet("fx_dust", "/assets/fx/dust.png", { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet("fx_explosion", "/assets/fx/explosion.png", { frameWidth: 192, frameHeight: 192 });
  }

  create() {
    this.createAnimations();
    this.buildMap();

    this.myCastle = this.add.image(0, 0, "castle_blue").setScale(0.5).setDepth(5);
    this.enemyCastle = this.add.image(0, 0, "castle_red").setScale(0.5).setDepth(5);
    this.enemyCastle.setInteractive({ cursor: "pointer" });
    this.enemyCastle.setData("kind", "enemy");
    this.myCastle.setInteractive({ cursor: "pointer" });
    this.myCastle.setData("kind", "my-building");
    this.myCastle.setData("role", "castle");
    this.myBaseBar = this.add.graphics().setDepth(6);
    this.enemyBaseBar = this.add.graphics().setDepth(6);

    gameEvents.on("spawn-unit", this.handleSpawnRequest, this);
    gameEvents.on("spawn-villager", this.handleSpawnVillager, this);
    gameEvents.on("build-house", this.handleBuildHouse, this);
    gameEvents.on("cancel-build-mode", this.cancelBuildMode, this);
    gameEvents.on("minimap-jump", this.handleMinimapJump, this);
    gameEvents.on("control-group-save", this.saveControlGroup, this);
    gameEvents.on("control-group-select", this.selectControlGroup, this);
    gameEvents.on("build-resource-house", this.handleBuildResourceHouse, this);
    gameEvents.on("toggle-pause", this.handleTogglePause, this);
    gameEvents.on("leave-room", this.handleLeave, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameEvents.off("spawn-unit", this.handleSpawnRequest, this);
      gameEvents.off("spawn-villager", this.handleSpawnVillager, this);
      gameEvents.off("build-house", this.handleBuildHouse, this);
      gameEvents.off("cancel-build-mode", this.cancelBuildMode, this);
      gameEvents.off("minimap-jump", this.handleMinimapJump, this);
      gameEvents.off("control-group-save", this.saveControlGroup, this);
      gameEvents.off("control-group-select", this.selectControlGroup, this);
    gameEvents.off("build-resource-house", this.handleBuildResourceHouse, this);
      gameEvents.off("toggle-pause", this.handleTogglePause, this);
      gameEvents.off("leave-room", this.handleLeave, this);
      this.sync?.disconnect();
      this.myVillagers?.destroy();
    });

    this.selectionRing = this.add.graphics().setDepth(12);
    this.buildingRing = this.add.graphics().setDepth(12);
    this.dragBoxG = this.add.graphics().setDepth(13);
    this.input.addPointer(2); // cho phép theo dõi 2 ngón tay cùng lúc để pinch-zoom
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", this.handlePointerDown, this);
      this.input.off("pointermove", this.handlePointerMove, this);
      this.input.off("pointerup", this.handlePointerUp, this);
    });

    // Control group bằng bàn phím (máy tính): Ctrl+1..4 lưu, 1..4 gọi lại
    if (this.input.keyboard) {
      const codes = [
        Phaser.Input.Keyboard.KeyCodes.ONE,
        Phaser.Input.Keyboard.KeyCodes.TWO,
        Phaser.Input.Keyboard.KeyCodes.THREE,
        Phaser.Input.Keyboard.KeyCodes.FOUR,
      ];
      codes.forEach((code, idx) => {
        const n = idx + 1;
        const key = this.input.keyboard!.addKey(code);
        key.on("down", (event: KeyboardEvent) => {
          if (event.ctrlKey || event.metaKey) this.saveControlGroup(n);
          else this.selectControlGroup(n);
        });
      });
    }

    this.connectRoom();
    this.emitHud();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.gameOver || this.paused) return;
        this.gold += GOLD_INCOME_PER_SEC;
        this.emitHud();
      },
    });
  }

  private handleTogglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    if (this.paused && this.buildMode) this.cancelBuildMode();
    this.sync?.setPaused?.(this.paused);
    gameEvents.emit("pause-state", { paused: this.paused });
  }

  private async connectRoom() {
    // Bot/Endless: luôn biết trước người chơi ở "left" — dựng base + lưới pathfinding
    // TRƯỚC khi tạo BotOpponent để AI có ngay bản đồ né vật cản đầy đủ (kể cả công trình của mình).
    const isBotLike = this.mode === "bot" || this.mode === "endless";
    if (isBotLike) {
      this.mySide = "left";
      this.layoutBases();
      this.buildNavigation();
      this.myVillagers?.setNavGrid(this.navGrid);
    }

    this.sync =
      this.mode === "bot"
        ? new BotOpponent(this.preset, "normal", false, undefined, this.navGrid)
        : this.mode === "endless"
        ? new BotOpponent(
            this.preset,
            "normal",
            true,
            (wave) => {
              this.currentWave = wave;
              gameEvents.emit("endless-wave", { wave });
            },
            this.navGrid
          )
        : new RoomSync(this.roomCode, this.isHost);

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
    this.opponentConnected = this.mode !== "online" ? true : this.opponentConnected;
    this.matchStartMs = this.time.now;
    if (!isBotLike) {
      this.layoutBases();
      this.buildNavigation();
      this.myVillagers?.setNavGrid(this.navGrid);
    }
    this.setupCamera();
    this.emitHud();
  }

  /** Dựng lưới pathfinding 1 lần khi vào trận — né sông (trừ đúng chỗ có cầu), đồi và công trình của mình */
  private buildNavigation() {
    const obstacles = this.hillObstacles.map((h) => ({ x: h.x, y: h.y, r: h.r }));
    // Né CẢ 2 phía — trước đây chỉ né công trình của mình, quân có thể đi xuyên thẳng qua
    // lâu đài/tháp canh của địch vì navGrid không hề biết công trình địch nằm ở đâu.
    for (const p of this.myBuildingPositions) obstacles.push({ x: p.x, y: p.y, r: 42 });
    for (const p of this.enemyBuildingPositions) obstacles.push({ x: p.x, y: p.y, r: 42 });
    this.navGrid = buildNavGrid(this.preset.worldW, this.preset.worldH, 28, obstacles, this.preset.waterBodies);
  }

  /**
   * Camera mặc định phải luôn "phủ kín" world theo cả 2 chiều — nếu zoom quá thấp so với
   * kích thước world, phần viewport vượt ra ngoài world sẽ lộ màu nền trống (đúng lỗi đã gặp:
   * mảng xanh đậm lớn phía dưới màn hình). minZoom đảm bảo điều đó không bao giờ xảy ra;
   * defaultZoom nhân thêm để castle/building đủ lớn, rõ ràng ngay khi vào trận.
   */
  private setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.preset.worldW, this.preset.worldH);
    this.recalcZoomBounds();
    const defaultZoom = Phaser.Math.Clamp(this.minZoom * 1.15, this.minZoom, this.maxZoom);
    cam.setZoom(defaultZoom);
    cam.centerOn(this.myBasePos.x, this.myBasePos.y);

    // Xoay máy / đổi kích thước cửa sổ → tính lại vùng nhìn & giới hạn zoom theo viewport MỚI.
    // Không đụng tới game state (unit/building/resource) — chỉ camera.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleViewportResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleViewportResize, this);
    });
  }

  private recalcZoomBounds() {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const fitZoomH = viewH / this.preset.worldH;
    const fitZoomW = viewW / this.preset.worldW;
    this.minZoom = Math.max(fitZoomH, fitZoomW);
    this.maxZoom = this.minZoom * 3.2;
  }

  private handleViewportResize() {
    const cam = this.cameras.main;
    const prevZoom = cam.zoom;
    this.recalcZoomBounds();
    // Giữ nguyên mức zoom hiện tại nếu vẫn hợp lệ với viewport mới; chỉ kẹp lại nếu vượt giới hạn
    // (ví dụ xoay dọc→ngang khiến viewport thấp hơn, minZoom tăng lên) — không re-center, không reset state.
    const clamped = Phaser.Math.Clamp(prevZoom, this.minZoom, this.maxZoom);
    cam.setZoom(clamped);
  }

  private layoutBases() {
    const myBaseSpec = this.mySide === "left" ? this.preset.baseLeft : this.preset.baseRight;
    const enemyBaseSpec = this.mySide === "left" ? this.preset.baseRight : this.preset.baseLeft;
    const myX = myBaseSpec.x;
    const myY = myBaseSpec.y;
    const enemyX = enemyBaseSpec.x;
    const enemyY = enemyBaseSpec.y;
    this.myFacingDir = myBaseSpec.facingDir;
    this.myBasePos = { x: myX, y: myY };
    this.enemyBasePos = { x: enemyX, y: enemyY };
    this.myBuildingPositions.push({ x: myX, y: myY });
    this.enemyBuildingPositions.push({ x: enemyX, y: enemyY });
    this.myCastle.setPosition(myX, myY);
    this.enemyCastle.setPosition(enemyX, enemyY);
    this.myCastle.setDepth(this.yDepth(myY));
    this.enemyCastle.setDepth(this.yDepth(enemyY));
    this.enemyCastle.setFlipX(this.mySide === "right");
    this.myCastle.setFlipX(this.mySide === "left");

    // Vùng lãnh thổ mờ dưới chân base
    const territory = this.add.graphics().setDepth(1);
    territory.fillStyle(0x3b82f6, 0.12);
    territory.fillEllipse(myX, myY + 10, 300, 190);
    territory.fillStyle(0xef4444, 0.12);
    territory.fillEllipse(enemyX, enemyY + 10, 300, 190);

    // Bóng đổ dưới base
    const shadow = this.add.graphics().setDepth(4);
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillEllipse(myX, myY + 70, 130, 24);
    shadow.fillEllipse(enemyX, enemyY + 70, 130, 24);

    // Cờ hiệu 2 bên base — mỗi base tự chọn dấu lệch (facingDir), không còn suy từ mySide
    const dirMine = myBaseSpec.facingDir;
    const dirEnemy = enemyBaseSpec.facingDir;
    const myFlag = this.add.image(myX + dirMine * 95, myY - 40, "banner").setScale(0.35).setDepth(5);
    myFlag.setTint(0x60a5fa);
    const enemyFlag = this.add.image(enemyX + dirEnemy * 95, enemyY - 40, "banner").setScale(0.35).setDepth(5);
    enemyFlag.setTint(0xf87171);

    // Mỏ vàng trang trí sau base
    this.add.image(myX, myY + 95, "goldmine").setScale(0.5).setDepth(4);
    this.add.image(enemyX, enemyY + 95, "goldmine").setScale(0.5).setDepth(4);

    // Cụm công trình quanh base — quyết định bởi kích thước bản đồ
    for (const b of this.preset.buildings) {
      const visual = BUILDING_VISUALS.find((v) => v.key === b);
      if (!visual) continue;
      const myBx = myX + dirMine * visual.offsetX;
      const enemyBx = enemyX + dirEnemy * visual.offsetX;
      const myBy = myY + visual.offsetY;
      const enemyBy = enemyY + visual.offsetY;
      const myImg = this.add.image(myBx, myBy, `bld_${b}_blue`).setScale(visual.scale).setDepth(this.yDepth(myBy));
      this.add.image(enemyBx, enemyBy, `bld_${b}_red`).setScale(visual.scale).setDepth(this.yDepth(enemyBy));
      myImg.setInteractive({ cursor: "pointer" });
      myImg.setData("kind", "my-building");
      myImg.setData("role", b);
      this.myBuildingPositions.push({ x: myBx, y: myBy });
      this.enemyBuildingPositions.push({ x: enemyBx, y: enemyBy });

      if (b === "tower") {
        this.myTowerPos = { x: myBx, y: myBy };
      }
    }

    // Mỏ tài nguyên quanh base của MÌNH — dân sẽ đi khai thác ở đây (vị trí xáo trộn nhẹ mỗi trận)
    const myNodePos: NodePositions = { wood: { x: 0, y: 0 }, gold: { x: 0, y: 0 }, meat: { x: 0, y: 0 } };
    for (const spec of RESOURCE_NODE_LAYOUT) {
      const jitterX = Phaser.Math.Between(-30, 30);
      const jitterY = Phaser.Math.Between(-25, 25);
      const nx = myX + dirMine * spec.offsetX + jitterX;
      const ny = Phaser.Math.Clamp(myY + spec.offsetY + jitterY, 20, this.preset.worldH - 20);
      myNodePos[spec.kind] = { x: nx, y: ny };
      if (spec.kind === "gold") {
        const img = this.add.image(nx, ny, "res_gold").setScale(0.7).setDepth(this.yDepth(ny));
        img.setInteractive({ cursor: "pointer" });
        img.setData("kind", "resource");
        img.setData("resourceKind", "gold");
        this.goldNodeSprite = img;
        this.goldNodePos = { x: nx, y: ny };
      } else if (spec.kind === "wood") {
        const t1 = this.add.sprite(nx - 16, ny, "res_tree1", 0).setScale(0.4).setDepth(this.yDepth(ny));
        t1.play("res_tree1-sway");
        const t2 = this.add.sprite(nx + 20, ny + 10, "res_tree2", 0).setScale(0.36).setDepth(this.yDepth(ny + 10));
        [t1, t2].forEach((s) => {
          s.setInteractive({ cursor: "pointer" });
          s.setData("kind", "resource");
          s.setData("resourceKind", "wood");
        });
        this.woodNodeSprites = [t1, t2];
        this.woodNodePos = { x: nx, y: ny };
      } else {
        const s1 = this.add.sprite(nx - 12, ny, "res_sheep", 0).setScale(0.55).setDepth(this.yDepth(ny));
        s1.play("res_sheep-idle");
        const s2 = this.add.sprite(nx + 18, ny + 8, "res_sheep", 0).setScale(0.5).setDepth(this.yDepth(ny + 8));
        s2.play("res_sheep-idle");
        [s1, s2].forEach((s) => {
          s.setInteractive({ cursor: "pointer" });
          s.setData("kind", "resource");
          s.setData("resourceKind", "meat");
        });
      }
    }

    this.myNodePosSaved = myNodePos;
    this.resourceNodeHp = { wood: RESOURCE_NODE_MAX_HP.wood, gold: RESOURCE_NODE_MAX_HP.gold };
    this.myVillagers = new VillagerSystem(
      this,
      this.mySide === "left" ? "blue" : "red",
      { x: myX, y: myY },
      myNodePos,
      (kind, amount, useNeutral) => this.handleVillagerDeposit(kind, amount, useNeutral),
      null,
      this.preset.neutralResources[0] ?? null
    );
    (["wood", "gold", "meat"] as const).forEach((k) => this.myVillagers!.addVillager(k));
  }

  private handleVillagerDeposit(kind: ResourceKind, amount: number, useNeutral = false) {
    if (kind === "gold") this.gold += amount;
    else if (kind === "wood") this.wood += amount;
    else this.meat += amount;

    if (useNeutral && kind === "gold" && !this.neutralGoldDepleted) {
      this.neutralGoldHp = Math.max(0, this.neutralGoldHp - amount);
      if (this.neutralGoldSprite) {
        const pct = this.neutralGoldHp / (RESOURCE_NODE_MAX_HP.gold ?? 288);
        if (pct <= 0.15) this.neutralGoldSprite.setTexture("res_gold_15");
        else if (pct <= 0.4) this.neutralGoldSprite.setTexture("res_gold_40");
        else if (pct <= 0.7) this.neutralGoldSprite.setTexture("res_gold_75");
      }
      if (this.neutralGoldHp <= 0) {
        this.neutralGoldDepleted = true;
        if (this.neutralGoldSprite) {
          this.playDeathFx(this.neutralGoldSprite.x, this.neutralGoldSprite.y);
          this.neutralGoldSprite.destroy();
          this.neutralGoldSprite = null;
        }
        this.myVillagers?.reassignAwayFrom("gold", this.pickAvailableResourceKind("gold"), true);
      }
    } else if (!useNeutral && (kind === "wood" || kind === "gold") && !this.resourceDepleted[kind]) {
      const maxHp = RESOURCE_NODE_MAX_HP[kind] ?? 1;
      const cur = Math.max(0, (this.resourceNodeHp[kind] ?? maxHp) - amount);
      this.resourceNodeHp[kind] = cur;
      this.updateResourceNodeVisual(kind, cur / maxHp);
      if (cur <= 0) this.depleteResourceNode(kind);
    }

    this.recomputePopCap();
    this.emitHud();
  }

  /** Đổi hình mỏ theo % còn lại — dùng đúng bộ sprite nhiều cỡ có sẵn trong gói thay vì giữ 1 hình cố định */
  private updateResourceNodeVisual(kind: "wood" | "gold", pct: number) {
    if (kind === "gold" && this.goldNodeSprite) {
      if (pct > 0.7) this.goldNodeSprite.setTexture("res_gold");
      else if (pct > 0.4) this.goldNodeSprite.setTexture("res_gold_75");
      else if (pct > 0.15) this.goldNodeSprite.setTexture("res_gold_40");
      else this.goldNodeSprite.setTexture("res_gold_15");
    } else if (kind === "wood" && this.woodNodeSprites.length) {
      // Cây thưa dần: khi còn < 50% thì bớt 1 cây, xuống thấp nữa mới đổi cây còn lại sang gốc cây
      const [t1, t2] = this.woodNodeSprites;
      if (pct <= 0.55 && t2.visible) t2.setVisible(false);
      if (pct <= 0.2 && t1.texture.key !== "res_stump") {
        t1.setTexture("res_stump").setScale(0.3).stop();
      }
    }
  }

  /** Mỏ cạn hẳn — biến mất, hiệu ứng bụi, và dân đang khai thác ở đây tự chuyển sang mỏ khác còn tài nguyên */
  private depleteResourceNode(kind: "wood" | "gold") {
    this.resourceDepleted[kind] = true;
    const pos = kind === "wood" ? this.woodNodePos : this.goldNodePos;
    if (pos) this.playDeathFx(pos.x, pos.y);
    if (kind === "gold" && this.goldNodeSprite) {
      this.goldNodeSprite.destroy();
      this.goldNodeSprite = null;
    } else if (kind === "wood") {
      this.woodNodeSprites.forEach((s) => s.destroy());
      this.woodNodeSprites = [];
    }
    this.myVillagers?.reassignAwayFrom(kind, this.pickAvailableResourceKind(kind));
  }

  /** Chọn 1 loại tài nguyên khác còn hàng để dồn dân bị "mất việc" sang — ưu tiên loại chưa cạn */
  private pickAvailableResourceKind(exclude: ResourceKind): ResourceKind {
    const order: ResourceKind[] = ["meat", "gold", "wood"].filter((k) => k !== exclude) as ResourceKind[];
    for (const k of order) {
      if (k === "meat" || !this.resourceDepleted[k as "wood" | "gold"]) return k;
    }
    return "meat";
  }

  private recomputePopCap() {
    const resourceHouseCount = Object.values(this.resourceHouses).filter(Boolean).length;
    this.popCap =
      computePopCap(this.preset.buildings.length, this.wood, this.meat) +
      this.housesBuilt * HOUSE_POP_BONUS +
      resourceHouseCount * RESOURCE_HOUSE_POP_BONUS;
  }

  private createAnimations() {
    const colors: Array<"blue" | "red"> = ["blue", "red"];
    const types: UnitType[] = ["pawn", "warrior", "archer", "monk"];
    for (const type of types) {
      for (const color of colors) {
        const key = `${type}_${color}`;
        if (UNIT_SPRITE_MODE[type] === "sheet") {
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
        } else {
          const frames = UNIT_PERACTION_FRAMES[type]!;
          const map: Array<["idle" | "walk" | "attack", "idle" | "run" | "attack", number]> = [
            ["idle", "idle", frames.idle],
            ["walk", "run", frames.walk],
            ["attack", "attack", frames.attack],
          ];
          for (const [kind, file, count] of map) {
            const animKey = `${key}-${kind}`;
            if (this.anims.exists(animKey)) continue;
            this.anims.create({
              key: animKey,
              frames: this.anims.generateFrameNumbers(`${key}_${file}`, { start: 0, end: count - 1 }),
              frameRate: kind === "attack" ? 12 : 10,
              repeat: kind === "attack" ? 0 : -1,
            });
          }
        }
      }
    }
    for (const color of colors) createVillagerAnimations(this, color);

    this.anims.create({ key: "res_tree1-sway", frames: this.anims.generateFrameNumbers("res_tree1", { start: 0, end: 7 }), frameRate: 4, repeat: -1 });
    this.anims.create({ key: "res_sheep-idle", frames: this.anims.generateFrameNumbers("res_sheep", { start: 0, end: 5 }), frameRate: 5, repeat: -1 });
    this.anims.create({
      key: "fx_dust-play",
      frames: this.anims.generateFrameNumbers("fx_dust", { start: 0, end: FX_DUST_FRAMES - 1 }),
      frameRate: 16,
      repeat: 0,
    });
    this.anims.create({
      key: "fx_explosion-play",
      frames: this.anims.generateFrameNumbers("fx_explosion", { start: 0, end: FX_EXPLOSION_FRAMES - 1 }),
      frameRate: 18,
      repeat: 0,
    });
  }

  private playHealFx(x: number, y: number) {
    const s = this.add.sprite(x, y - 20, "fx_dust", 0).setScale(0.5).setDepth(15).setTint(0x8ef58e);
    s.play("fx_dust-play");
    s.once("animationcomplete", () => s.destroy());
  }

  private playDeathFx(x: number, y: number) {
    const s = this.add.sprite(x, y, "fx_dust", 0).setScale(0.8).setDepth(15);
    s.play("fx_dust-play");
    s.once("animationcomplete", () => s.destroy());
  }

  private playExplosionFx(x: number, y: number) {
    const s = this.add.sprite(x, y, "fx_explosion", 0).setScale(0.9).setDepth(21);
    s.play("fx_explosion-play");
    s.once("animationcomplete", () => s.destroy());
  }

  private initialTexture(type: UnitType, color: "blue" | "red"): string {
    if (UNIT_SPRITE_MODE[type] === "sheet") return `${type}_${color}`;
    return `${type}_${color}_run`;
  }

  private buildMap() {
    const { worldW, worldH, grassTexture } = this.preset;
    this.cameras.main.setBackgroundColor("#2f4d2a");

    // Lớp 1 — biển bao quanh (chỉ lộ ra thành viền trên/dưới, đảo đất là lớp 2 nổi lên trên)
    const seaRim = 26;
    const sea = this.add.tileSprite(0, 0, worldW, worldH, "water_tile").setOrigin(0, 0).setDepth(-1);
    sea.setTileScale(1, 1);

    // Lớp 2 — đảo đất chính (thụt vào so với mép biển)
    const bg = this.add.tileSprite(0, seaRim, worldW, worldH - seaRim * 2, grassTexture).setOrigin(0, 0).setDepth(0);
    bg.setTileScale(0.9, 0.9);

    // Viền vách nhẹ giữa đất và biển
    const shore = this.add.graphics().setDepth(0.5);
    shore.lineStyle(3, 0xd8f0e8, 0.4);
    shore.lineBetween(0, seaRim, worldW, seaRim);
    shore.lineBetween(0, worldH - seaRim, worldW, worldH - seaRim);
    shore.lineStyle(1.5, 0x0e5f5a, 0.3);
    shore.lineBetween(0, seaRim - 2, worldW, seaRim - 2);
    shore.lineBetween(0, worldH - seaRim + 2, worldW, worldH - seaRim + 2);

    // Bụi/đá/nấm trang trí rải ngẫu nhiên khắp bản đồ (không còn theo 1 dải "lane" cố định —
    // địa hình giờ đến từ hillSpecs/forestClusters/waterBodies, không phải 2 hàng ngang song song).
    const decoKeys = ["deco_bush", "deco_bush2", "deco_rock", "deco_mushroom"];
    const decoCount = Math.max(6, Math.round((worldW * worldH) / 90000));
    for (let d = 0; d < decoCount; d++) {
      const x = Phaser.Math.Between(60, worldW - 60);
      const y = Phaser.Math.Between(seaRim + 40, worldH - seaRim - 40);
      const key = decoKeys[d % decoKeys.length];
      this.add.image(x, y, key).setScale(0.55).setDepth(this.yDepth(y) - 0.5).setAlpha(0.9);
    }

    // Vài đảo nhỏ nổi ngoài biển (thuần trang trí) ở 2 góc — lớp "đất" phụ, tăng cảm giác quần đảo
    this.add.image(60, 6, "islet_flat").setScale(0.22).setDepth(1).setAlpha(0.95);
    this.add.image(worldW - 60, worldH - 6, "islet_flat").setScale(0.2).setDepth(1).setAlpha(0.95);

    this.buildWaterBodies();
    this.buildHills();
    this.buildClouds();
  }

  /** Layer trên cùng — vài đám mây trôi ngang qua bản đồ, chỉ trang trí không cản gì */
  private buildClouds() {
    const count = Math.max(3, Math.round(this.preset.worldW / 420));
    for (let i = 0; i < count; i++) {
      const key = CLOUD_KEYS[i % CLOUD_KEYS.length];
      const y = Phaser.Math.Between(30, this.preset.worldH - 30);
      const startX = Phaser.Math.Between(-100, this.preset.worldW + 100);
      const cloud = this.add.image(startX, y, key).setDepth(30).setAlpha(0.55).setScale(Phaser.Math.FloatBetween(0.7, 1.1));
      const speed = Phaser.Math.FloatBetween(6, 14);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.tweens.add({
        targets: cloud,
        x: dir > 0 ? this.preset.worldW + 120 : -120,
        duration: ((this.preset.worldW + 220) / speed) * 1000,
        repeat: -1,
        onRepeat: () => {
          cloud.x = dir > 0 ? -120 : this.preset.worldW + 120;
          cloud.y = Phaser.Math.Between(30, this.preset.worldH - 30);
        },
      });
    }
  }

  /** Vẽ toàn bộ vùng nước của map — mỗi map có 0..n dải (`WaterBand`), ghép lại tạo sông/hồ/biển
   *  hình dạng bất kỳ. Mỗi dải có thể chạy dọc hoặc ngang, cầu đặt dọc theo đúng trục của nó. */
  private buildWaterBodies() {
    this.waterBands = this.preset.waterBodies;
    for (const band of this.waterBands) {
      const { xMin, xMax, yMin, yMax, orientation, bridgeAt, bridgeGap } = band;
      const w = xMax - xMin;
      const h = yMax - yMin;

      const water = this.add.tileSprite(xMin, yMin, w, h, "water_tile").setOrigin(0, 0).setDepth(2);
      water.setTileScale(1, 1);

      const shore = this.add.graphics().setDepth(2);
      shore.lineStyle(3, 0xbdf4f0, 0.55);
      shore.strokeRect(xMin, yMin, w, h);
      shore.lineStyle(1.5, 0x0e5f5a, 0.35);
      shore.strokeRect(xMin - 2, yMin - 2, w + 4, h + 4);

      for (const at of bridgeAt) {
        const plank = this.add.graphics().setDepth(3);
        if (orientation === "vertical") {
          const top = at - bridgeGap / 2;
          plank.fillStyle(0x8a5a34, 1);
          plank.fillRect(xMin - 6, top, w + 12, bridgeGap);
          plank.lineStyle(2, 0x5c3a1e, 0.8);
          for (let px = xMin - 6; px < xMax + 6; px += 10) plank.lineBetween(px, top, px, top + bridgeGap);
          plank.lineStyle(3, 0x5c3a1e, 0.9);
          plank.strokeRect(xMin - 6, top, w + 12, bridgeGap);
        } else {
          const left = at - bridgeGap / 2;
          plank.fillStyle(0x8a5a34, 1);
          plank.fillRect(left, yMin - 6, bridgeGap, h + 12);
          plank.lineStyle(2, 0x5c3a1e, 0.8);
          for (let py = yMin - 6; py < yMax + 6; py += 10) plank.lineBetween(left, py, left + bridgeGap, py);
          plank.lineStyle(3, 0x5c3a1e, 0.9);
          plank.strokeRect(left, yMin - 6, bridgeGap, h + 12);
        }
      }
    }
  }

  private buildHills() {
    this.hillObstacles = [];
    this.hillPlateaus = [];
    for (const h of this.preset.hillSpecs) {
      const shadow = this.add.graphics().setDepth(2);
      shadow.fillStyle(0x000000, 0.22);
      shadow.fillEllipse(h.x, h.y + 60 * h.scale, 130 * h.scale, 26 * h.scale);
      // Lớp 3 — đảo đá cao hơn mặt đất chính (dùng đúng prop vách đá thật của bộ Tiny Swords)
      this.add.image(h.x, h.y, "islet_cliff").setScale(h.scale * 0.75).setDepth(3);
      const rockKey = Phaser.Math.RND.pick(["deco_rock", "deco_bush"]);
      this.add.image(h.x - 24 * h.scale, h.y - 40 * h.scale, rockKey).setScale(0.45 * h.scale).setDepth(4);
      // Vật cản pathfinding chỉ còn đúng phần lõi đá (rìa vách) — mặt đồi (plateau) rộng hơn thì
      // đi qua được VÀ xây được, thay vì coi cả quả đồi là 1 khối bít kín như trước.
      this.hillObstacles.push({ x: h.x, y: h.y, r: 20 * h.scale });
      this.hillPlateaus.push({ x: h.x, y: h.y, r: 55 * h.scale });
    }
    this.buildForestClusters();
    this.buildNeutralResource();
  }

  /** Mỏ vàng trung lập giữa 2 lãnh thổ — cả 2 bên đều cử dân qua được, nhưng phải băng đúng cây cầu.
   *  Hiện chỉ mỏ VÀNG đầu tiên trong danh sách được gắn logic tranh chấp/khai thác thật (các entry
   *  khác nếu có chỉ mang tính trang trí) — xem `handleVillagerDeposit`. */
  private buildNeutralResource() {
    const n = this.preset.neutralResources.find((r) => r.kind === "gold");
    if (!n) return;
    const shadow = this.add.graphics().setDepth(2);
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillEllipse(n.x, n.y + 18, 60, 16);
    const img = this.add.image(n.x, n.y, "res_gold").setScale(0.85).setDepth(this.yDepth(n.y));
    img.setInteractive({ cursor: "pointer" });
    img.setData("kind", "resource");
    img.setData("resourceKind", "gold");
    img.setData("neutral", true);
    // Viền vàng nhẹ nhấp nháy — báo hiệu đây là điểm tranh chấp, không phải mỏ riêng của ai
    const ring = this.add.graphics().setDepth(this.yDepth(n.y) - 0.001);
    ring.lineStyle(2, 0xfacc15, 0.7);
    ring.strokeCircle(n.x, n.y, 34);
    this.tweens.add({ targets: ring, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
    this.neutralGoldSprite = img;
    this.neutralGoldHp = RESOURCE_NODE_MAX_HP.gold ?? 288;
  }

  /**
   * Cụm rừng NẰM TRONG bản đồ (không chỉ ở viền như trước) — vừa trang trí vừa là vật cản thật
   * (dùng chung mảng né tránh với đồi), tạo choke point khiến đường đi giữa 2 base không còn
   * là 1 đường thẳng mà phải len qua cầu + vòng qua rừng/đồi.
   */
  private buildForestClusters() {
    const treeKeys = ["tree_a", "tree_b", "tree_c"];
    let seed = 0;
    for (const c of this.preset.forestClusters) {
      for (let i = 0; i < c.count; i++) {
        seed++;
        const angle = (i / c.count) * Math.PI * 2 + seed * 0.7;
        const rad = 18 + (i % 3) * 14;
        const tx = c.x + Math.cos(angle) * rad;
        const ty = c.y + Math.sin(angle) * rad * 0.7;
        const key = treeKeys[seed % treeKeys.length];
        this.add.image(tx, ty, key).setScale(c.scale).setDepth(this.yDepth(ty)).setOrigin(0.5, 0.85);
      }
      // bán kính vật cản ước theo số cây trong cụm — cụm càng đông càng khó len qua giữa
      const obstacleR = 26 + c.count * 7;
      this.hillObstacles.push({ x: c.x, y: c.y, r: obstacleR * c.scale * 2.1 });
    }
  }

  // ── Điều khiển thủ công: chọn quân/dân rồi bấm để ra lệnh (hỗ trợ kéo-chọn nhiều) ──
  /** Di chuyển 1 quân theo đường đi A* thật tới (targetX,targetY) — chỉ tính lại đường khi đích đổi (>20px) */
  private followPath(u: LocalUnit, targetX: number, targetY: number, speed: number, dt: number, isManual: boolean) {
    const targetKey = `${Math.round(targetX / 10)},${Math.round(targetY / 10)}`;
    if (!u.path || u.pathTargetKey !== targetKey) {
      u.path = this.navGrid ? findPath(this.navGrid, u.x, u.y, targetX, targetY) : [{ x: targetX, y: targetY }];
      u.pathIndex = 0;
      u.pathTargetKey = targetKey;
    }
    const path = u.path;
    if (!path || !path.length) return;
    if (u.pathIndex >= path.length) u.pathIndex = path.length - 1;
    const wp = path[u.pathIndex];
    const dx = wp.x - u.x;
    const dy = wp.y - u.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const step = speed * dt;

    if (d <= Math.max(step, 6)) {
      u.x = wp.x;
      u.y = wp.y;
      if (u.pathIndex >= path.length - 1) {
        if (isManual) u.manualTarget = null;
        u.path = null;
      } else {
        u.pathIndex++;
      }
    } else {
      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
      u.sprite.setFlipX(dx < 0);
    }
  }

  private handlePinchZoom() {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1?.isDown && p2?.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinchStartDist === 0) {
        this.pinchStartDist = dist;
        this.pinchStartZoom = this.cameras.main.zoom;
        // 2 ngón đang giữ → huỷ mọi thao tác kéo/chọn 1 ngón đang dở dang
        this.dragStart = null;
        this.isDragging = false;
        this.isPanning = false;
        this.dragBoxG.clear();
      } else {
        const scale = dist / this.pinchStartDist;
        const newZoom = Phaser.Math.Clamp(this.pinchStartZoom * scale, this.minZoom, this.maxZoom);
        this.cameras.main.setZoom(newZoom);
      }
    } else {
      this.pinchStartDist = 0;
    }
  }

  // ── Input: TAP vs DRAG luôn phân biệt bằng ngưỡng di chuyển — không xử lý gì trên
  // pointerdown ngoài build-mode/minimap/pinch; MỌI lựa chọn (unit/villager/building/enemy)
  // chỉ thực thi ở pointerup, và CHỈ khi tổng quãng đường di chuyển chưa vượt ngưỡng (10px).
  // Nhờ vậy: chạm vào Castle rồi vuốt để kéo camera sẽ KHÔNG mở Build Menu.
  private readonly TAP_THRESHOLD = 10;
  private pendingHit: Phaser.GameObjects.GameObject | null = null;
  private lastTapId: string | null = null;
  private lastTapAt = 0;
  private controlGroups: Record<number, { kind: "unit" | "villager"; id: string }[]> = { 1: [], 2: [], 3: [], 4: [] };

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (this.gameOver || this.paused) return;
    if (this.buildMode) {
      this.confirmBuildPlacement(pointer.worldX, pointer.worldY);
      return;
    }
    if (this.input.pointer1?.isDown && this.input.pointer2?.isDown) return; // đang pinch, bỏ qua tap thường

    // CHỈ ghi nhận — chưa quyết định gì. Quyết định TAP hay DRAG diễn ra ở pointerup/pointermove.
    const hits = this.input.hitTestPointer(pointer) as Phaser.GameObjects.GameObject[];
    this.pendingHit = hits[0] ?? null;
    this.dragStart = { x: pointer.worldX, y: pointer.worldY };
    this.dragStartScreen = { x: pointer.x, y: pointer.y };
    this.isDragging = false;
    this.isPanning = false;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (this.buildMode && this.ghostSprite) {
      this.ghostSprite.setPosition(pointer.worldX, pointer.worldY);
      const valid = this.isValidBuildSpot(pointer.worldX, pointer.worldY);
      this.ghostSprite.setTint(valid ? 0xffffff : 0xff8888);
      return;
    }
    if (this.input.pointer1?.isDown && this.input.pointer2?.isDown) return; // đang pinch bằng 2 ngón — camera do handlePinchZoom lo
    if (!this.dragStart || !pointer.isDown) return;
    const isTouch = pointer.wasTouch;

    if (isTouch) {
      const dxScreen = pointer.x - (this.dragStartScreen?.x ?? pointer.x);
      const dyScreen = pointer.y - (this.dragStartScreen?.y ?? pointer.y);
      if (!this.isPanning && Math.hypot(dxScreen, dyScreen) > this.TAP_THRESHOLD) {
        this.isPanning = true; // vượt ngưỡng → chắc chắn là kéo camera, huỷ hẳn "tap đang chờ"
        this.pendingHit = null;
      }
      if (this.isPanning) {
        const cam = this.cameras.main;
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
      }
      return;
    }

    const dx = pointer.worldX - this.dragStart.x;
    const dy = pointer.worldY - this.dragStart.y;
    if (!this.isDragging && Math.hypot(dx, dy) > this.TAP_THRESHOLD) {
      this.isDragging = true;
      this.pendingHit = null; // vượt ngưỡng → là kéo-chọn-vùng, không phải tap
    }
    if (this.isDragging) {
      this.dragBoxG.clear();
      this.dragBoxG.lineStyle(1.5, 0x8ef58e, 0.9);
      this.dragBoxG.fillStyle(0x8ef58e, 0.12);
      const x = Math.min(this.dragStart.x, pointer.worldX);
      const y = Math.min(this.dragStart.y, pointer.worldY);
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      this.dragBoxG.fillRect(x, y, w, h);
      this.dragBoxG.strokeRect(x, y, w, h);
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    if (this.gameOver || this.paused || this.buildMode) {
      this.resetPointerState();
      return;
    }

    if (this.isPanning) {
      // vừa cuộn camera xong — chắc chắn không phải tap, không chọn/ra lệnh gì cả
    } else if (this.isDragging && this.dragStart) {
      // Kéo-chọn-vùng (chuột) — đã xác nhận không phải tap lên 1 object cụ thể
      const x1 = Math.min(this.dragStart.x, pointer.worldX);
      const x2 = Math.max(this.dragStart.x, pointer.worldX);
      const y1 = Math.min(this.dragStart.y, pointer.worldY);
      const y2 = Math.max(this.dragStart.y, pointer.worldY);
      const picked: { kind: "unit" | "villager"; id: string }[] = [];
      for (const u of this.localUnits.values()) {
        if (u.state === "dead") continue;
        if (u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) picked.push({ kind: "unit", id: u.id });
      }
      if (this.myVillagers) {
        for (const v of this.myVillagers.sprites) {
          if (v.x >= x1 && v.x <= x2 && v.y >= y1 && v.y <= y2) {
            const id = v.getData("villagerId");
            if (id) picked.push({ kind: "villager", id });
          }
        }
      }
      if (picked.length) {
        this.selected = picked;
        this.selectedBuildingPos = null;
      }
    } else {
      // TAP thật sự (chưa từng vượt ngưỡng di chuyển) — giờ mới xử lý object đã ghi nhận lúc pointerdown
      this.resolveTap();
    }
    this.resetPointerState();
  }

  private resolveTap() {
    const hit = this.pendingHit;
    if (hit) {
      const kind = hit.getData("kind");
      if (kind === "my-unit") {
        const unitId = hit.getData("unitId");
        if (this.checkDoubleTap(unitId)) {
          const u = this.localUnits.get(unitId);
          if (u) {
            this.selected = Array.from(this.localUnits.values())
              .filter((ou) => ou.state !== "dead" && ou.type === u.type)
              .map((ou) => ({ kind: "unit" as const, id: ou.id }));
          }
        } else if (this.selected.length === 1 && this.selected[0].kind === "unit" && this.selected[0].id === unitId) {
          this.selected = []; // bấm lại đúng unit đang chọn 1 mình → bỏ chọn (thoát khỏi lựa chọn)
        } else {
          this.selected = [{ kind: "unit", id: unitId }];
        }
        this.selectedBuildingPos = null;
        return;
      }
      if (kind === "my-villager") {
        const villagerId = hit.getData("villagerId");
        if (this.checkDoubleTap(villagerId)) {
          this.selected =
            this.myVillagers?.sprites.map((s) => ({ kind: "villager" as const, id: s.getData("villagerId") })) ?? [];
        } else if (
          this.selected.length === 1 &&
          this.selected[0].kind === "villager" &&
          this.selected[0].id === villagerId
        ) {
          this.selected = [];
        } else {
          this.selected = [{ kind: "villager", id: villagerId }];
        }
        this.selectedBuildingPos = null;
        return;
      }
      if (kind === "resource" && this.selected.some((s) => s.kind === "villager")) {
        const isNeutral = hit.getData("neutral") === true;
        for (const s of this.selected) {
          if (s.kind !== "villager") continue;
          if (isNeutral) this.myVillagers?.reassignToNeutral(s.id);
          else this.myVillagers?.reassignKind(s.id, hit.getData("resourceKind"));
        }
        return;
      }
      if (kind === "resource" && this.selected.length === 0 && !hit.getData("neutral")) {
        const obj = hit as unknown as { x: number; y: number };
        this.selectedBuildingPos = { x: obj.x, y: obj.y };
        gameEvents.emit("select-building", { role: `resource-${hit.getData("resourceKind")}` });
        return;
      }
      if (kind === "enemy" && this.selected.length > 0) {
        const obj = hit as unknown as { x: number; y: number };
        this.issueMoveCommand(obj.x, obj.y);
        return;
      }
      if (kind === "my-building") {
        // Bấm công trình CỦA MÌNH luôn ưu tiên mở bảng quản lý — kể cả khi đang chọn quân,
        // đây cũng là 1 cách "thoát" khỏi lựa chọn quân hiện tại (không lỡ ra lệnh quân đi tới đó).
        this.selected = [];
        const obj = hit as unknown as { x: number; y: number };
        this.selectedBuildingPos = { x: obj.x, y: obj.y };
        gameEvents.emit("select-building", { role: hit.getData("role") });
        return;
      }
      return;
    }
    // Tap vào chỗ trống
    if (this.selected.length > 0 && this.dragStart) {
      this.issueMoveCommand(this.dragStart.x, this.dragStart.y);
    } else if (this.selectedBuildingPos) {
      this.selectedBuildingPos = null;
      gameEvents.emit("deselect-building");
    }
  }

  private checkDoubleTap(id: string): boolean {
    const now = this.time.now;
    const isDouble = this.lastTapId === id && now - this.lastTapAt < 350;
    this.lastTapId = id;
    this.lastTapAt = now;
    return isDouble;
  }

  private resetPointerState() {
    this.pendingHit = null;
    this.dragStart = null;
    this.dragStartScreen = null;
    this.isDragging = false;
    this.isPanning = false;
    this.dragBoxG.clear();
  }

  private issueMoveCommand(x: number, y: number) {
    if (!this.selected.length) return;
    const cx = Phaser.Math.Clamp(x, 15, this.preset.worldW - 15);
    const cy = Phaser.Math.Clamp(y, 15, this.preset.worldH - 15);
    const n = this.selected.length;
    this.selected.forEach((s, i) => {
      // Dàn đội hình nhẹ quanh điểm đích để quân không chồng lên nhau khi đi theo nhóm
      const angle = (i / Math.max(1, n)) * Math.PI * 2;
      const spread = n > 1 ? Math.min(46, 10 + n * 3) : 0;
      const tx = Phaser.Math.Clamp(cx + Math.cos(angle) * spread, 15, this.preset.worldW - 15);
      const ty = Phaser.Math.Clamp(cy + Math.sin(angle) * spread, 15, this.preset.worldH - 15);
      if (s.kind === "unit") {
        const u = this.localUnits.get(s.id);
        if (u) u.manualTarget = { x: tx, y: ty };
      } else {
        this.myVillagers?.commandMove(s.id, tx, ty);
      }
    });
  }

  private drawSelectionRing() {
    this.selectionRing.clear();
    this.buildingRing.clear();
    if (this.selectedBuildingPos) {
      this.drawCornerBrackets(this.buildingRing, this.selectedBuildingPos.x, this.selectedBuildingPos.y, 46, 0xfacc15);
    }
    if (!this.selected.length) return;
    const stillAlive: { kind: "unit" | "villager"; id: string }[] = [];
    this.selectionRing.lineStyle(2, 0xffffff, 0.85);
    for (const s of this.selected) {
      let pos: { x: number; y: number } | null = null;
      if (s.kind === "unit") {
        const u = this.localUnits.get(s.id);
        pos = u ? { x: u.x, y: u.y } : null;
      } else {
        pos = this.myVillagers?.getPos(s.id) ?? null;
      }
      if (pos) {
        stillAlive.push(s);
        this.selectionRing.strokeEllipse(pos.x, pos.y, 36, 18);
      }
    }
    this.selected = stillAlive;
  }

  /** Vẽ 4 góc đánh dấu quanh 1 điểm — kiểu "selection corners" chuẩn RTS thay vì khung chữ nhật kín */
  private drawCornerBrackets(g: Phaser.GameObjects.Graphics, cx: number, cy: number, half: number, color: number) {
    g.lineStyle(3, color, 0.95);
    const len = half * 0.55;
    const corners: [number, number, number, number][] = [
      [cx - half, cy - half, 1, 1],
      [cx + half, cy - half, -1, 1],
      [cx - half, cy + half, 1, -1],
      [cx + half, cy + half, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      g.lineBetween(x, y, x + len * dx, y);
      g.lineBetween(x, y, x, y + len * dy);
    }
  }

  // ── Spawn ──────────────────────────────────────────────────────────
  private handleSpawnVillager() {
    if (this.gameOver || !this.myVillagers || !this.myVillagers.canAdd()) return;
    if (this.gold < VILLAGER_COST) return;
    this.gold -= VILLAGER_COST;
    this.myVillagers.addVillager();
    this.emitHud();
  }

  private handleBuildHouse() {
    if (this.gameOver || this.housesBuilt >= HOUSE_MAX_COUNT || this.buildMode) return;
    if (this.gold < HOUSE_COST) return;
    this.buildMode = { type: "house" };
    const color = this.mySide === "left" ? "blue" : "red";
    this.ghostSprite = this.add
      .image(this.myBasePos.x, this.myBasePos.y, `bld_house1_${color}`)
      .setScale(0.4)
      .setAlpha(0.6)
      .setDepth(50);
    gameEvents.emit("build-mode-start", { label: "Nhà dân" });
  }

  private isValidBuildSpot(x: number, y: number): boolean {
    if (!this.buildMode) return false;
    for (const band of this.waterBands) {
      if (x > band.xMin - 24 && x < band.xMax + 24 && y > band.yMin - 24 && y < band.yMax + 24) return false;
    }
    for (const p of this.myBuildingPositions) {
      if (Phaser.Math.Distance.Between(x, y, p.x, p.y) < 50) return false;
    }
    if (this.buildMode.type === "house") {
      const distBase = Phaser.Math.Distance.Between(x, y, this.myBasePos.x, this.myBasePos.y);
      if (distBase <= 280) return true;
      // Không đủ gần base thì vẫn cho xây nếu đang đứng trên mặt phẳng (plateau) của 1 quả đồi —
      // đồi giờ là địa hình cao xây được, không còn là khối bít kín như trước.
      return this.isOnBuildablePlateau(x, y);
    }
    const node = this.myNodePosSaved?.[this.buildMode.kind];
    if (!node) return false;
    return Phaser.Math.Distance.Between(x, y, node.x, node.y) <= 95;
  }

  private isOnBuildablePlateau(x: number, y: number): boolean {
    for (const p of this.hillPlateaus) {
      if (Phaser.Math.Distance.Between(x, y, p.x, p.y) <= p.r) return true;
    }
    return false;
  }

  private confirmBuildPlacement(x: number, y: number) {
    if (!this.buildMode) return;
    if (!this.isValidBuildSpot(x, y)) {
      if (this.ghostSprite) {
        this.ghostSprite.setTintFill(0xff2222);
        this.time.delayedCall(160, () => this.ghostSprite?.clearTint());
      }
      return; // vị trí không hợp lệ — giữ nguyên build mode để thử lại
    }
    const color = this.mySide === "left" ? "blue" : "red";
    const img = this.add.image(x, y, `bld_house1_${color}`).setScale(0).setDepth(this.yDepth(y));
    img.setInteractive({ cursor: "pointer" });
    img.setData("kind", "my-building");
    this.myBuildingPositions.push({ x, y });

    if (this.buildMode.type === "house") {
      this.gold -= HOUSE_COST;
      img.setData("role", "house1");
      this.tweens.add({ targets: img, scale: 0.4, duration: 240, ease: "Back.Out" });
      this.housesBuilt++;
      this.myVillagers?.increaseMax(HOUSE_VILLAGER_BONUS);
    } else {
      const kind = this.buildMode.kind;
      this.gold -= RESOURCE_HOUSE_COST;
      this.resourceHouses[kind] = true;
      img.setData("role", `resource-${kind}`);
      this.tweens.add({ targets: img, scale: 0.32, duration: 240, ease: "Back.Out" });
      this.myVillagers?.increaseMax(1);
      this.myVillagers?.addVillager(kind); // dân miễn phí, đi thẳng vào đúng mỏ này
    }
    this.recomputePopCap();
    this.cancelBuildMode();
    this.emitHud();
  }

  private cancelBuildMode() {
    this.ghostSprite?.destroy();
    this.ghostSprite = null;
    this.buildMode = null;
    gameEvents.emit("build-mode-end");
  }

  private handleBuildResourceHouse(kind: ResourceKind) {
    if (this.gameOver || this.resourceHouses[kind] || !this.myNodePosSaved || this.buildMode) return;
    if (this.gold < RESOURCE_HOUSE_COST) return;
    this.buildMode = { type: "resource", kind };
    const node = this.myNodePosSaved[kind];
    const color = this.mySide === "left" ? "blue" : "red";
    this.ghostSprite = this.add
      .image(node.x, node.y - 30, `bld_house1_${color}`)
      .setScale(0.32)
      .setAlpha(0.6)
      .setDepth(50);
    gameEvents.emit("build-mode-start", { label: `Nhà cạnh mỏ ${RESOURCE_LABEL[kind]}` });
  }

  private handleSpawnRequest(type: UnitType) {
    if (this.gameOver || !this.opponentConnected) return;
    if (this.localUnits.size >= this.popCap) return;
    const cfg = UNIT_CONFIGS[type];
    if (this.gold < cfg.cost) return;
    this.gold -= cfg.cost;
    this.emitHud();

    const id = `${this.sync.playerId}-${this.unitCounter++}`;
    // Spawn ở phía "mặt trận" của base (ngược dấu facingDir — facingDir đẩy công trình RA SAU,
    // nên quân mới xuất hiện ở hướng đối diện, tức là hướng ra chiến trường).
    const startX = this.myBasePos.x - this.myFacingDir * 60;
    const y = Phaser.Math.Clamp(this.myBasePos.y + Phaser.Math.Between(-50, 50), 20, this.preset.worldH - 20);
    const spriteKey = `${type}_${this.mySide === "left" ? "blue" : "red"}`;
    const sprite = this.add.sprite(startX, y, this.initialTexture(type, this.mySide === "left" ? "blue" : "red"), 0).setScale(0.4).setDepth(10);
    sprite.setFlipX(this.mySide === "right");
    sprite.play(`${spriteKey}-walk`);
    sprite.setScale(0);
    sprite.setInteractive({ cursor: "pointer" });
    sprite.setData("kind", "my-unit");
    sprite.setData("unitId", id);
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
      manualTarget: null,
      path: null,
      pathIndex: 0,
      pathTargetKey: "",
    });
  }

  // ── Nhận trạng thái/đòn đánh từ đối thủ ─────────────────────────────
  private applyRemoteState(p: StatePayload) {
    if (this.enemyBaseHp > 0 && p.baseHp <= 0) {
      this.playExplosionFx(this.enemyCastle.x, this.enemyCastle.y);
    }
    this.enemyBaseHp = p.baseHp;
    const seen = new Set<string>();
    for (const u of p.units) {
      seen.add(u.id);
      let ru = this.remoteUnits.get(u.id);
      if (!ru && u.hp > 0) {
        const spriteKey = `${u.type}_${p.side === "left" ? "blue" : "red"}`;
        const sprite = this.add
          .sprite(u.x, u.y, this.initialTexture(u.type, p.side === "left" ? "blue" : "red"), 0)
          .setScale(0.4)
          .setDepth(10);
        sprite.setFlipX(p.side === "right");
        sprite.play(`${spriteKey}-walk`);
        sprite.setInteractive({ cursor: "pointer" });
        sprite.setData("kind", "enemy");
        const hpBar = this.add.graphics().setDepth(11);
        ru = {
          sprite,
          hpBar,
          targetX: u.x,
          targetY: u.y,
          hp: u.hp,
          maxHp: u.maxHp,
          type: u.type,
          spriteKey,
          lastAnimState: "walk",
        };
        this.remoteUnits.set(u.id, ru);
      }
      if (ru) {
        ru.targetX = u.x;
        ru.targetY = u.y;
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

  private destroyRemoteUnit(id: string) {
    const ru = this.remoteUnits.get(id);
    if (!ru) return;
    this.playDeathFx(ru.sprite.x, ru.sprite.y);
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
        this.playExplosionFx(this.myCastle.x, this.myCastle.y);
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
      this.playDeathFx(u.sprite.x, u.sprite.y);
      u.sprite.destroy();
      u.hpBar.destroy();
      this.localUnits.delete(targetId);
      this.emitHud();
    }
  }

  update(time: number, delta: number) {
    this.handlePinchZoom();
    if (this.gameOver || this.paused) return;
    const dt = delta / 1000;

    for (const u of this.localUnits.values()) {
      if (u.state === "dead") continue;
      const cfg = UNIT_CONFIGS[u.type];
      const isHealer = cfg.role === "heal";

      let actionTargetId: string | null = null;
      let actionDist = Infinity;
      if (isHealer) {
        for (const [oid, ou] of this.localUnits) {
          if (oid === u.id || ou.state === "dead" || ou.hp >= ou.maxHp) continue;
          const d = Phaser.Math.Distance.Between(u.x, u.y, ou.x, ou.y);
          if (d < actionDist) {
            actionDist = d;
            actionTargetId = oid;
          }
        }
      } else {
        for (const [rid, ru] of this.remoteUnits) {
          const d = Phaser.Math.Distance.Between(u.x, u.y, ru.sprite.x, ru.sprite.y);
          if (d < actionDist) {
            actionDist = d;
            actionTargetId = rid;
          }
        }
      }
      const distToBase = isHealer
        ? Infinity
        : Phaser.Math.Distance.Between(u.x, u.y, this.enemyBasePos.x, this.enemyBasePos.y);

      const canHitUnit = actionTargetId !== null && actionDist <= cfg.range;
      const canHitBase = !isHealer && !canHitUnit && distToBase <= Math.max(cfg.range, BASE_HIT_RADIUS);

      if (canHitUnit || canHitBase) {
        u.state = "attack";
        if (u.lastAnimState !== "attack") {
          u.lastAnimState = "attack";
          u.sprite.play(`${u.spriteKey}-attack`);
        }
        if (time - u.lastAttackAt >= cfg.attackCooldownMs) {
          u.lastAttackAt = time;
          u.sprite.play(`${u.spriteKey}-attack`);
          if (isHealer && canHitUnit && actionTargetId) {
            const target = this.localUnits.get(actionTargetId);
            if (target) {
              target.hp = Math.min(target.maxHp, target.hp + (cfg.healAmount ?? 10));
              this.playHealFx(target.x, target.y);
            }
          } else if (canHitUnit && actionTargetId) {
            this.sync.sendHit(actionTargetId, cfg.damage);
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
        const finalX = u.manualTarget ? u.manualTarget.x : this.enemyBasePos.x;
        const finalY = u.manualTarget ? u.manualTarget.y : this.enemyBasePos.y;
        this.followPath(u, finalX, finalY, cfg.speed, dt, !!u.manualTarget);
        u.x = Phaser.Math.Clamp(u.x, 20, this.preset.worldW - 20);
        u.y = Phaser.Math.Clamp(u.y, 20, this.preset.worldH - 20);
      }

      u.sprite.setPosition(u.x, u.y);
      u.sprite.setDepth(this.yDepth(u.y));
      this.drawHpBar(u.hpBar, u.x, u.y - 34, u.hp, u.maxHp, 30);
    }

    for (const ru of this.remoteUnits.values()) {
      ru.sprite.x = Phaser.Math.Linear(ru.sprite.x, ru.targetX, Math.min(1, dt * 6));
      ru.sprite.y = Phaser.Math.Linear(ru.sprite.y, ru.targetY, Math.min(1, dt * 6));
      ru.sprite.setDepth(this.yDepth(ru.sprite.y));
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

    this.myVillagers?.update(dt, time);
    if (time - this.lastMinimapEmitAt >= 130) {
      this.lastMinimapEmitAt = time;
      this.emitMinimapData();
    }
    this.drawSelectionRing();

    if (time - this.lastBroadcastAt >= STATE_BROADCAST_MS) {
      this.lastBroadcastAt = time;
      this.broadcastState();
    }
  }

  // Vị trí + kích thước minimap tính theo màn hình (không phải theo bản đồ) vì minimap cố định trên camera
  // Đặt góc dưới-trái theo đúng chuẩn bố cục RTS mobile (không đụng nút Settings ở trên-phải)
  /**
   * Depth thống nhất cho MỌI object có thể "đứng trước/sau" nhau theo chiều sâu — castle, building,
   * mỏ tài nguyên, unit, dân. Dùng world Y (điểm chân) làm depth thay vì số cố định theo loại object,
   * nên unit đi trước building thì che building, đi sau thì bị building che — tự nhiên theo đúng vị trí,
   * không phải luật cứng "unit luôn ở trên" hay "building luôn ở trên".
   */
  private yDepth(y: number): number {
    return 6 + y / 1000;
  }

  /** Phát dữ liệu minimap ra ngoài cho React vẽ bằng HTML/SVG — screen-space thật 100%,
   * không dính camera.zoom (khác với vẽ bằng Phaser Graphics dù có scrollFactor(0) vẫn bị
   * zoom theo camera — đó chính là lỗi minimap co giãn/lệch đã gặp). */
  private handleMinimapJump(p: { x: number; y: number }) {
    this.cameras.main.centerOn(p.x, p.y);
  }

  /** Ctrl+N (PC) hoặc giữ nút N + đang có quân chọn (mobile) → lưu lựa chọn hiện tại vào group N */
  private saveControlGroup(n: number) {
    if (!this.selected.length) return;
    this.controlGroups[n] = [...this.selected];
    gameEvents.emit("control-group-update", { group: n, count: this.selected.length });
  }

  /** Bấm N (PC) hoặc tap nút N (mobile) → chọn lại toàn bộ quân còn sống trong group N */
  private selectControlGroup(n: number) {
    const group = this.controlGroups[n];
    if (!group || !group.length) return;
    const stillAlive = group.filter((s) =>
      s.kind === "unit" ? this.localUnits.has(s.id) : !!this.myVillagers?.getPos(s.id)
    );
    this.controlGroups[n] = stillAlive; // loại luôn ref chết khỏi group, không giữ lại
    if (!stillAlive.length) return;
    this.selected = stillAlive;
    this.selectedBuildingPos = null;
  }

  private emitMinimapData() {
    const cam = this.cameras.main;
    gameEvents.emit("minimap-data", {
      worldW: this.preset.worldW,
      worldH: this.preset.worldH,
      myBase: { x: this.myCastle.x, y: this.myCastle.y },
      enemyBase: { x: this.enemyCastle.x, y: this.enemyCastle.y },
      myUnits: Array.from(this.localUnits.values())
        .filter((u) => u.state !== "dead")
        .map((u) => ({ x: u.x, y: u.y })),
      enemyUnits: Array.from(this.remoteUnits.values()).map((ru) => ({ x: ru.sprite.x, y: ru.sprite.y })),
      camera: { x: cam.worldView.x, y: cam.worldView.y, w: cam.worldView.width, h: cam.worldView.height },
    });
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
      y: u.y,
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
      wood: this.wood,
      meat: this.meat,
      myBaseHp: this.myBaseHp,
      myBaseMaxHp: BASE_MAX_HP,
      enemyBaseHp: this.enemyBaseHp,
      enemyBaseMaxHp: BASE_MAX_HP,
      opponentConnected: this.opponentConnected,
      myUnits: this.localUnits.size,
      popCap: this.popCap,
      villagers: this.myVillagers?.count ?? 0,
      villagerMax: this.myVillagers?.max ?? VILLAGER_MAX_COUNT,
      houses: this.housesBuilt,
      housesMax: HOUSE_MAX_COUNT,
      resourceHouses: this.resourceHouses,
    });
  }

  private endGame(youWin: boolean) {
    if (this.gameOver) return;
    this.gameOver = true;
    if (this.mode === "endless") {
      const timeSec = Math.floor((this.time.now - this.matchStartMs) / 1000);
      gameEvents.emit("game-end", { youWin: false, wave: this.currentWave, timeSec });
    } else {
      gameEvents.emit("game-end", { youWin });
    }
  }

  private handleLeave() {
    this.sync?.disconnect();
  }
}
