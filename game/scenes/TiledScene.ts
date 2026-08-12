import Phaser from "phaser";
import { buildNavGridFromWalkable, findPath, NavGrid } from "@/game/pathfinding";

interface MetaObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  image: string | null;
}
interface MetaJson {
  worldW: number;
  worldH: number;
  tileSize: number;
  objects: MetaObject[];
  walkableGrid: boolean[][];
  tilesetImages: { name: string; image: string }[];
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
  private testUnit!: Phaser.GameObjects.Arc;
  private testPath: { x: number; y: number }[] | null = null;
  private testPathIndex = 0;
  private minZoom = 0.3;
  private maxZoom = 2;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super("TiledScene");
  }

  preload() {
    this.load.json("meta", `${MAP_BASE}/meta.json`);
  }

  create() {
    this.meta = this.cache.json.get("meta") as MetaJson;

    // Nạp lượt 2: ảnh tileset + file tilemap chuẩn Tiled — chỉ biết cần tải gì SAU khi đọc xong meta.json
    for (const t of this.meta.tilesetImages) {
      this.load.image(`ts_${t.name}`, `${MAP_BASE}/${t.image}`);
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
    });

    // Object: building/cây... — Ảnh thật, đặt đúng toạ độ pixel đã tính sẵn từ lúc gộp file
    for (const o of this.meta.objects) {
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

    // Quân test — spawn cạnh base phía Tây, bấm vào bản đồ để thấy nó tự né nước/đá đi vòng
    if (west) {
      this.testUnit = this.add.circle(west.x + 60, west.y + 60, 14, 0x60a5fa).setDepth(2000).setStrokeStyle(2, 0xffffff);
    }

    // Camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.meta.worldW, this.meta.worldH);
    const fitZoomH = this.scale.height / this.meta.worldH;
    const fitZoomW = this.scale.width / this.meta.worldW;
    this.minZoom = Math.max(fitZoomH, fitZoomW);
    this.maxZoom = this.minZoom * 4;
    cam.setZoom(Phaser.Math.Clamp(this.minZoom * 1.1, this.minZoom, this.maxZoom));
    if (west) cam.centerOn(west.x, west.y);

    this.statusText = this.add
      .text(10, 10, `Map cộng đồng — ${this.meta.worldW}x${this.meta.worldH}px — bấm vào map để test A*`, {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000090",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(9999);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.navGrid || !this.testUnit) return;
      this.testPath = findPath(this.navGrid, this.testUnit.x, this.testUnit.y, p.worldX, p.worldY);
      this.testPathIndex = 0;
    });

    // Kéo camera bằng chuột/chạm để xem toàn bản đồ
    let dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !dragStart) return;
      cam.scrollX = dragStart.scrollX - (p.x - dragStart.x) / cam.zoom;
      cam.scrollY = dragStart.scrollY - (p.y - dragStart.y) / cam.zoom;
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      dragStart = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
    });
    this.input.on("pointerup", () => (dragStart = null));

    this.input.on(
      "wheel",
      (_p: unknown, _go: unknown, _dx: number, dy: number) => {
        cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, this.minZoom, this.maxZoom));
      }
    );
  }

  update() {
    if (!this.testUnit || !this.testPath || !this.testPath.length) return;
    const wp = this.testPath[this.testPathIndex];
    if (!wp) return;
    const dx = wp.x - this.testUnit.x;
    const dy = wp.y - this.testUnit.y;
    const d = Math.hypot(dx, dy);
    const step = 140 * (1 / 60);
    if (d <= Math.max(step, 4)) {
      this.testUnit.x = wp.x;
      this.testUnit.y = wp.y;
      this.testPathIndex++;
      if (this.testPathIndex >= this.testPath.length) this.testPath = null;
    } else {
      this.testUnit.x += (dx / d) * step;
      this.testUnit.y += (dy / d) * step;
    }
  }
}
