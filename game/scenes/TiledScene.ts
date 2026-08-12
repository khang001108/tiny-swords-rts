import Phaser from "phaser";
import { buildNavGridFromWalkable, findPath, NavGrid } from "@/game/pathfinding";

interface MetaObjectAnimation {
  tilesetName: string;
  frames: { tileid: number; duration: number }[];
  columns: number;
  tileWidth: number;
  tileHeight: number;
}
interface MetaObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  image: string | null;
  animation: MetaObjectAnimation | null;
}
interface AnimatedCell {
  layerIndex: number;
  row: number;
  col: number;
  tilesetFirstgid: number;
  frames: { tileid: number; duration: number }[];
}
interface MetaJson {
  worldW: number;
  worldH: number;
  tileSize: number;
  objects: MetaObject[];
  walkableGrid: boolean[][];
  tilesetImages: { name: string; image: string }[];
  animatedCells: AnimatedCell[];
}

const MAP_BASE = "/assets/maps/community1";

/**
 * Scene load map do người dùng tự vẽ bằng Tiled (xuất .tmj) — hoàn toàn tách biệt khỏi
 * MainScene.ts (map dựng bằng code) để không có rủi ro phá vỡ chế độ chơi chính đang chạy ổn.
 * Đây là bản kiểm chứng bộ nạp: hiện đúng bản đồ thật + demo pathfinding A* né nước/đá thật
 * bằng cách bấm vào map để 1 quân test di chuyển tới.
 */
export default class TiledScene extends Phaser.Scene {
  private meta!: MetaJson;
  private navGrid: NavGrid | null = null;
  private player!: Phaser.GameObjects.Sprite;
  private playerPath: { x: number; y: number }[] | null = null;
  private playerPathIndex = 0;
  private playerState: "idle" | "walk" = "idle";
  private minZoom = 0.3;
  private maxZoom = 2;
  private statusText!: Phaser.GameObjects.Text;
  private mapLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  private animFrameIndex = 0;
  private selectionRing!: Phaser.GameObjects.Graphics;

  // phân biệt TAP (ra lệnh di chuyển) và DRAG (kéo camera) — không xử lý ngay lúc pointerdown
  private readonly TAP_THRESHOLD = 10;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  private isDragging = false;

  constructor() {
    super("TiledScene");
  }

  preload() {
    this.load.json("meta", `${MAP_BASE}/meta.json`);
    this.load.spritesheet("player_idle", "/assets/units2/warrior_blue_idle.png", { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet("player_run", "/assets/units2/warrior_blue_run.png", { frameWidth: 192, frameHeight: 192 });
  }

  create() {
    this.meta = this.cache.json.get("meta") as MetaJson;

    // Nạp lượt 2: ảnh tileset + file tilemap chuẩn Tiled — chỉ biết cần tải gì SAU khi đọc xong meta.json
    for (const t of this.meta.tilesetImages) {
      this.load.image(`ts_${t.name}`, `${MAP_BASE}/${t.image}`);
    }
    // Object có animation cần nạp THÊM 1 bản dạng spritesheet riêng (tách khung hình theo đúng
    // tileWidth/tileHeight của tileset đó) — texture thường (load.image) không tách khung được.
    const animTilesetsSeen = new Map<string, MetaObjectAnimation>();
    for (const o of this.meta.objects) {
      if (o.animation && !animTilesetsSeen.has(o.animation.tilesetName)) {
        animTilesetsSeen.set(o.animation.tilesetName, o.animation);
      }
    }
    for (const [tsName, a] of animTilesetsSeen) {
      const imgPath = this.meta.tilesetImages.find((t) => t.name === tsName)?.image;
      if (!imgPath) continue;
      this.load.spritesheet(`tsanim_${tsName}`, `${MAP_BASE}/${imgPath}`, {
        frameWidth: a.tileWidth,
        frameHeight: a.tileHeight,
      });
    }
    const objImageKeys = new Set<string>();
    for (const o of this.meta.objects) {
      if (o.image) objImageKeys.add(o.image);
    }
    objImageKeys.forEach((img) => this.load.image(`obj_${img}`, `${MAP_BASE}/${img}`));
    this.load.tilemapTiledJSON("communitymap", `${MAP_BASE}/tilemap.json`);

    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.buildScene());
    this.load.start();
  }

  private buildScene() {
    const map = this.make.tilemap({ key: "communitymap" });
    const tilesets = this.meta.tilesetImages
      .map((t) => map.addTilesetImage(t.name, `ts_${t.name}`))
      .filter((t): t is Phaser.Tilemaps.Tileset => t !== null);

    map.layers.forEach((layerData, i) => {
      const layer = map.createLayer(layerData.name, tilesets, 0, 0);
      layer?.setDepth(i);
      if (layer) this.mapLayers.push(layer);
    });

    // Object: building/cây... — dùng Sprite + animation thật nếu tile gốc có animation
    // (sóng nước/cây lay động/cừu nhảy/vịt lắc lư — dữ liệu animation lấy thẳng từ Tiled, không tự chế).
    for (const o of this.meta.objects) {
      if (o.animation) {
        const a = o.animation;
        const texKey = `tsanim_${a.tilesetName}`;
        const animKey = `anim_${a.tilesetName}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: a.frames.map((f) => ({ key: texKey, frame: f.tileid })),
            frameRate: 1000 / (a.frames[0]?.duration || 100),
            repeat: -1,
          });
        }
        const spr = this.add.sprite(o.x, o.y - o.height, texKey, a.frames[0].tileid).setOrigin(0, 0);
        spr.setDisplaySize(o.width, o.height);
        spr.play(animKey);
        spr.setDepth(1000 + o.y / 100000);
        spr.setData("name", o.name);
        spr.setData("type", o.type);
        continue;
      }
      if (!o.image) continue;
      const img = this.add.image(o.x, o.y - o.height, `obj_${o.image}`).setOrigin(0, 0);
      img.setDisplaySize(o.width, o.height);
      img.setDepth(1000 + o.y / 100000);
      img.setData("name", o.name);
      img.setData("type", o.type);
    }

    // Pathfinding thật — dựng NavGrid từ walkableGrid đã tính sẵn (không suy luận từ vòng tròn/sông giả)
    this.navGrid = buildNavGridFromWalkable(this.meta.walkableGrid, this.meta.tileSize, this.meta.worldW, this.meta.worldH);

    // 2 base — xác định trái/phải theo toạ độ X thật (không dựa vào tên đặt)
    const bases = this.meta.objects.filter((o) => o.type === "base").sort((a, b) => a.x - b.x);
    const west = bases[0];
    const east = bases[bases.length - 1];

    // Nhân vật điều khiển được — spawn cạnh base phía Tây, luôn di chuyển bằng đường A* thật
    // (findPath tự nắn về ô walkable gần nhất nếu bấm trúng nước/đá — không bao giờ đi xuyên).
    this.anims.create({
      key: "player-idle",
      frames: this.anims.generateFrameNumbers("player_idle", { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: "player-walk",
      frames: this.anims.generateFrameNumbers("player_run", { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1,
    });

    if (west) {
      this.player = this.add.sprite(west.x + 70, west.y + 70, "player_idle", 0).setScale(0.4);
      this.player.play("player-idle");
      this.player.setDepth(5000);
    }

    this.selectionRing = this.add.graphics().setDepth(4999);

    // Camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.meta.worldW, this.meta.worldH);
    const fitZoomH = this.scale.height / this.meta.worldH;
    const fitZoomW = this.scale.width / this.meta.worldW;
    this.minZoom = Math.max(fitZoomH, fitZoomW);
    this.maxZoom = this.minZoom * 4;
    cam.setZoom(Phaser.Math.Clamp(this.minZoom * 1.1, this.minZoom, this.maxZoom));
    if (west) cam.centerOn(west.x, west.y);

    // Sóng nước / tile có animation trong layer — Phaser Tilemap không tự động phát animation tile,
    // nên mình tự cập nhật khung hình theo đúng chu kỳ (duration) lấy từ dữ liệu Tiled gốc.
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        this.animFrameIndex++;
        for (const cell of this.meta.animatedCells) {
          const layer = this.mapLayers[cell.layerIndex];
          if (!layer) continue;
          const frame = cell.frames[this.animFrameIndex % cell.frames.length];
          layer.putTileAt(cell.tilesetFirstgid + frame.tileid, cell.col, cell.row);
        }
      },
    });

    this.statusText = this.add
      .text(10, 10, `Map cộng đồng — ${this.meta.worldW}x${this.meta.worldH}px — bấm vào map để di chuyển`, {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000090",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(9999);

    // ── Input: TAP = ra lệnh di chuyển, DRAG = kéo camera — tách biệt bằng ngưỡng khoảng cách,
    // không xử lý ngay lúc pointerdown (giống hệt cách MainScene.ts xử lý, tránh lỡ tay mở nhầm) ──
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragStart = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      this.isDragging = false;
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.dragStart) return;
      const dx = p.x - this.dragStart.x;
      const dy = p.y - this.dragStart.y;
      if (!this.isDragging && Math.hypot(dx, dy) > this.TAP_THRESHOLD) this.isDragging = true;
      if (this.isDragging) {
        cam.scrollX = this.dragStart.scrollX - dx / cam.zoom;
        cam.scrollY = this.dragStart.scrollY - dy / cam.zoom;
      }
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.isDragging && this.dragStart && this.navGrid && this.player) {
        // chỉ là 1 cú TAP (không kéo) → ra lệnh di chuyển tới đúng điểm bấm
        this.playerPath = findPath(this.navGrid, this.player.x, this.player.y, p.worldX, p.worldY);
        this.playerPathIndex = 0;
      }
      this.dragStart = null;
      this.isDragging = false;
    });

    this.input.on("wheel", (_p: unknown, _go: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, this.minZoom, this.maxZoom));
    });
  }

  update() {
    if (!this.player) return;

    // vòng tròn chọn nhân vật, luôn theo đúng vị trí hiện tại
    this.selectionRing.clear();
    this.selectionRing.lineStyle(2, 0xffffff, 0.85);
    this.selectionRing.strokeEllipse(this.player.x, this.player.y, 36, 18);

    if (!this.playerPath || !this.playerPath.length) {
      if (this.playerState !== "idle") {
        this.playerState = "idle";
        this.player.play("player-idle", true);
      }
      return;
    }
    const wp = this.playerPath[this.playerPathIndex];
    if (!wp) return;
    if (this.playerState !== "walk") {
      this.playerState = "walk";
      this.player.play("player-walk", true);
    }
    const dx = wp.x - this.player.x;
    const dy = wp.y - this.player.y;
    const d = Math.hypot(dx, dy);
    const step = 140 * (1 / 60);
    if (d <= Math.max(step, 4)) {
      this.player.x = wp.x;
      this.player.y = wp.y;
      this.playerPathIndex++;
      if (this.playerPathIndex >= this.playerPath.length) this.playerPath = null;
    } else {
      this.player.x += (dx / d) * step;
      this.player.y += (dy / d) * step;
      this.player.setFlipX(dx < 0);
    }
  }
}
