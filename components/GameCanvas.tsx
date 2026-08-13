"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import { createPhaserGame } from "@/game/PhaserGame";
import {
  gameEvents,
  HudUpdate,
  GameEndUpdate,
  PauseState,
  BuildingSelection,
  BuildingRole,
  EndlessWaveUpdate,
  BuildModeStart,
  MinimapData,
} from "@/game/events";
import {
  UNIT_CONFIGS,
  UnitType,
  MapId,
  MAP_PRESETS,
  VILLAGER_COST,
  HOUSE_COST,
  RESOURCE_HOUSE_COST,
  RESOURCE_LABEL,
  ResourceKind,
  ENDLESS_RECORD_KEY,
} from "@/game/entities";
import NineSlice from "@/components/NineSlice";

const BUILDING_LABEL: Record<Exclude<BuildingRole, `resource-${ResourceKind}`>, string> = {
  castle: "Lâu đài",
  barracks: "Doanh trại",
  tower: "Tháp canh",
  house1: "Nhà dân",
  monastery: "Tu viện",
};
const BUILDING_THUMB: Record<Exclude<BuildingRole, `resource-${ResourceKind}`>, string> = {
  castle: "/assets/buildings/Castle_Blue.png",
  barracks: "/assets/buildings/Barracks_Blue.png",
  tower: "/assets/buildings/Tower_Blue.png",
  house1: "/assets/buildings/House1_Blue.png",
  monastery: "/assets/buildings/Monastery_Blue.png",
};
const RESOURCE_THUMB: Record<ResourceKind, string> = {
  wood: "/assets/ui9/icon-wood.png",
  gold: "/assets/resources/gold_node.png",
  meat: "/assets/ui9/icon-meat.png",
};
function buildingLabel(role: BuildingRole): string {
  if (role.startsWith("resource-")) {
    const kind = role.replace("resource-", "") as ResourceKind;
    return `Mỏ ${RESOURCE_LABEL[kind]}`;
  }
  return BUILDING_LABEL[role as Exclude<BuildingRole, `resource-${ResourceKind}`>];
}
function buildingThumb(role: BuildingRole): string {
  if (role.startsWith("resource-")) {
    const kind = role.replace("resource-", "") as ResourceKind;
    return RESOURCE_THUMB[kind];
  }
  return BUILDING_THUMB[role as Exclude<BuildingRole, `resource-${ResourceKind}`>];
}
const icon = (name: string) => `/assets/ui9/icon-${name}.png`;

export default function GameCanvas({
  roomCode,
  isHost,
  mode,
  mapId,
}: {
  roomCode: string;
  isHost: boolean;
  mode: "bot" | "online" | "endless";
  mapId: MapId;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HudUpdate>({
    gold: 0,
    wood: 0,
    meat: 0,
    myBaseHp: 1,
    myBaseMaxHp: 1,
    enemyBaseHp: 1,
    enemyBaseMaxHp: 1,
    opponentConnected: false,
    myUnits: 0,
    popCap: 6,
    villagers: 0,
    villagerMax: 6,
    houses: 0,
    housesMax: 3,
    resourceHouses: { wood: false, gold: false, meat: false },
  });
  const [result, setResult] = useState<GameEndUpdate | null>(null);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [buildingRole, setBuildingRole] = useState<BuildingRole>("castle");
  const [hasSelection, setHasSelection] = useState(false);
  const [buildModeLabel, setBuildModeLabel] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [wave, setWave] = useState(1);
  const [minimap, setMinimap] = useState<MinimapData | null>(null);
  const [bestRecord, setBestRecord] = useState<{ wave: number; timeSec: number } | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);

  useEffect(() => {
    if (mode !== "endless") return;
    try {
      const raw = localStorage.getItem(ENDLESS_RECORD_KEY);
      if (raw) setBestRecord(JSON.parse(raw));
    } catch {
      // localStorage có thể bị chặn (chế độ riêng tư) — bỏ qua, không có kỷ lục lưu được
    }
  }, [mode]);

  useEffect(() => {
    const t = setTimeout(() => setShowTutorial(false), 9000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = createPhaserGame(containerRef.current, roomCode, isHost, mode, mapId);

    const onHud = (p: HudUpdate) => setHud(p);
    const onEnd = (p: GameEndUpdate) => {
      setResult(p);
      if (mode === "endless" && p.wave !== undefined && p.timeSec !== undefined) {
        const isBetter = !bestRecord || p.wave > bestRecord.wave || (p.wave === bestRecord.wave && p.timeSec > bestRecord.timeSec);
        if (isBetter) {
          const rec = { wave: p.wave, timeSec: p.timeSec };
          setBestRecord(rec);
          setIsNewRecord(true);
          try {
            localStorage.setItem(ENDLESS_RECORD_KEY, JSON.stringify(rec));
          } catch {
            // bỏ qua nếu không lưu được
          }
        } else {
          setIsNewRecord(false);
        }
      }
    };
    const onPause = (p: PauseState) => setPaused(p.paused);
    const onBuilding = (p: BuildingSelection) => {
      setBuildingRole(p.role);
      setHasSelection(true);
      setShowTutorial(false);
    };
    const onDeselect = () => setHasSelection(false);
    const onWave = (p: EndlessWaveUpdate) => setWave(p.wave);
    const onBuildStart = (p: BuildModeStart) => setBuildModeLabel(p.label);
    const onBuildEnd = () => setBuildModeLabel(null);
    const onMinimap = (p: MinimapData) => setMinimap(p);

    gameEvents.on("hud-update", onHud);
    gameEvents.on("game-end", onEnd);
    gameEvents.on("pause-state", onPause);
    gameEvents.on("select-building", onBuilding);
    gameEvents.on("deselect-building", onDeselect);
    gameEvents.on("endless-wave", onWave);
    gameEvents.on("build-mode-start", onBuildStart);
    gameEvents.on("build-mode-end", onBuildEnd);
    gameEvents.on("minimap-data", onMinimap);

    return () => {
      gameEvents.off("hud-update", onHud);
      gameEvents.off("game-end", onEnd);
      gameEvents.off("pause-state", onPause);
      gameEvents.off("select-building", onBuilding);
      gameEvents.off("deselect-building", onDeselect);
      gameEvents.off("endless-wave", onWave);
      gameEvents.off("build-mode-start", onBuildStart);
      gameEvents.off("build-mode-end", onBuildEnd);
      gameEvents.off("minimap-data", onMinimap);
      gameEvents.emit("leave-room");
      game.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, isHost, mode, mapId]);

  const spawn = (type: UnitType) => gameEvents.emit("spawn-unit", type);
  const spawnVillager = () => gameEvents.emit("spawn-villager");
  const buildHouse = () => gameEvents.emit("build-house");
  const buildResourceHouse = (kind: ResourceKind) => gameEvents.emit("build-resource-house", kind);
  const cancelBuildMode = () => gameEvents.emit("cancel-build-mode");
  const togglePause = () => {
    gameEvents.emit("toggle-pause");
    setSettingsOpen(false);
  };

  const atCap = hud.myUnits >= hud.popCap;
  const hasNeutralResource = MAP_PRESETS[mapId].neutralResources.length > 0;

  return (
    <div className="w-full mx-auto" style={{ maxWidth: 900 }}>
      {/* ══ GAME WORLD — canvas Phaser lo hết: terrain/unit/building/camera/minimap ══ */}
      <div
        ref={containerRef}
        className="relative w-full mx-auto rounded-lg overflow-hidden border border-white/10 shadow-xl touch-none select-none"
        style={{ width: "100%", height: "min(94vh, 900px)" }}
      >
        {/* ══ SCREEN SPACE cố định ══ */}

        <div
          className="absolute top-0 inset-x-0 flex justify-center z-20 pointer-events-none"
          style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
        >
          <div className="pointer-events-auto w-[82%] rounded-full bg-[#e9dcbb]/95 border border-black/25 shadow-md px-2.5 py-1 flex items-center justify-center gap-2.5 text-[#3a2c1a] text-[11px] flex-wrap">
            <span className="flex items-center font-bold text-amber-700">
              <img src={icon("gold")} className="icon-inline" alt="" />
              {hud.gold}
            </span>
            <span className="flex items-center font-bold text-lime-800">
              <img src={icon("wood")} className="icon-inline" alt="" />
              {hud.wood}
            </span>
            <span className="flex items-center font-bold text-rose-800">
              <img src={icon("meat")} className="icon-inline" alt="" />
              {hud.meat}
            </span>
            <span className="flex items-center font-medium">
              <img src={icon("swords")} className="icon-inline" alt="" />
              {hud.myUnits}/{hud.popCap}
            </span>
            <span className="flex items-center font-medium">
              <img src={icon("hammer")} className="icon-inline" alt="" />
              {hud.villagers}/{hud.villagerMax}
            </span>
          </div>
        </div>

        <div
          className="absolute top-0 right-0 z-30"
          style={{ paddingTop: "max(8px, env(safe-area-inset-top))", paddingRight: "max(8px, env(safe-area-inset-right))" }}
        >
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="w-7 h-7 rounded-full bg-[#3a2c1a]/85 border border-white/30 flex items-center justify-center shadow-md active:scale-95 transition"
          >
            <img src={icon("settings")} className="w-4 h-4" alt="Cài đặt" />
          </button>
          {settingsOpen && (
            <div className="mt-1 w-40 rounded-lg bg-[#e9dcbb] border border-black/25 shadow-lg overflow-hidden text-sm text-[#3a2c1a]">
              <button onClick={togglePause} className="w-full text-left px-3 py-2 hover:bg-black/5 flex items-center gap-2">
                <img src={icon(paused ? "play" : "close")} className="icon-inline m-0" alt="" />
                {paused ? "Tiếp tục" : "Tạm dừng"}
              </button>
              <a href="/" className="w-full text-left px-3 py-2 hover:bg-black/5 flex items-center gap-2 border-t border-black/10">
                <img src={icon("back")} className="icon-inline m-0" alt="" />
                Về sảnh chờ
              </a>
            </div>
          )}
        </div>

        {/* Control group 1-4 — chạm nhanh để chọn lại, giữ ~500ms để lưu quân đang chọn vào group đó */}
        <div
          className="absolute top-0 left-0 z-30 flex gap-1.5"
          style={{ paddingTop: "max(8px, env(safe-area-inset-top))", paddingLeft: "max(8px, env(safe-area-inset-left))" }}
        >
          {[1, 2, 3, 4].map((n) => (
            <ControlGroupButton key={n} n={n} />
          ))}
        </div>

        <div className="absolute top-10 inset-x-0 flex justify-center z-10 pointer-events-none px-3">
          <span className="text-[11px] text-white/85 bg-black/30 rounded-full px-2.5 py-0.5 drop-shadow">
            {mode === "online" ? `Phòng ${roomCode}` : mode === "endless" ? `🌊 Sóng ${wave}` : "Đấu với Bot"}
            {mode !== "endless" && (
              <span className={hud.opponentConnected ? "text-emerald-300 ml-1.5" : "text-amber-300 ml-1.5"}>
                {hud.opponentConnected ? "● đã vào" : "● đang chờ..."}
              </span>
            )}
          </span>
        </div>

        {showTutorial && !result && (
          <div
            className="absolute inset-x-4 z-10 flex justify-center pointer-events-none animate-[fadeIn_0.4s_ease]"
            style={{ top: "24%" }}
          >
            <div className="pointer-events-auto max-w-[88%] bg-black/60 text-white text-xs text-center rounded-lg px-3 py-2 shadow-lg border border-white/10">
              💡 Bấm vào <b>Lâu đài</b> để xây dựng và tuyển quân — bấm lính rồi bấm nơi muốn tới để ra lệnh.
              {hasNeutralResource &&
                " Có mỏ vàng viền sáng giữa bản đồ ai cũng khai thác được — bấm dân rồi bấm vào đó để cử qua tranh mỏ!"}
            </div>
          </div>
        )}

        {/* Đang đặt công trình (ghost preview theo dõi trong canvas, đây chỉ là thanh trạng thái + nút huỷ) */}
        {buildModeLabel && (
          <div className="absolute inset-x-4 z-30 flex justify-center pointer-events-none" style={{ top: "24%" }}>
            <div className="pointer-events-auto flex items-center gap-2 bg-black/70 text-white text-xs rounded-full pl-3 pr-1.5 py-1.5 shadow-lg border border-white/10">
              <span>
                Đang đặt <b>{buildModeLabel}</b> — bấm vào bản đồ để đặt
              </span>
              <button onClick={cancelBuildMode} className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                <img src={icon("close")} className="w-3.5 h-3.5" alt="Huỷ" />
              </button>
            </div>
          </div>
        )}

        {paused && !result && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-white mb-4">⏸ Đã tạm dừng</div>
              <button onClick={togglePause} className="w-40 h-12 block mx-auto">
                <NineSlice prefix="btn-blue" className="w-full h-full">
                  <span className="font-bold text-white text-sm">Tiếp tục</span>
                </NineSlice>
              </button>
              {mode === "online" && (
                <p className="text-white/50 text-xs mt-3 max-w-[260px]">
                  Lưu ý: ở chế độ chơi với người, tạm dừng chỉ dừng phía bạn — đối thủ vẫn tiếp tục hành động.
                </p>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
            <NineSlice prefix="paper" style={{ width: 320, height: mode === "endless" ? 250 : 210 }}>
              <div className="flex flex-col items-center gap-2 px-4">
                <div className={`text-2xl font-extrabold ${result.youWin ? "text-emerald-700" : "text-red-700"}`}>
                  {mode === "endless" ? "💀 ĐÃ GỤC NGÃ" : result.youWin ? "🏆 BẠN THẮNG!" : "💀 BẠN THUA"}
                </div>
                {mode === "endless" && result.wave !== undefined && result.timeSec !== undefined && (
                  <div className="text-center text-[#3a2c1a] text-sm">
                    <div>
                      Trụ được <b>Sóng {result.wave}</b> — <b>{formatTime(result.timeSec)}</b>
                    </div>
                    {isNewRecord && <div className="text-amber-600 font-bold mt-1">🎉 Kỷ lục mới!</div>}
                  </div>
                )}
                <a href="/" className="w-40 h-12 block mt-1">
                  <NineSlice prefix="btn-blue" className="w-full h-full">
                    <span className="font-bold text-white text-sm drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                      Về sảnh chờ
                    </span>
                  </NineSlice>
                </a>
              </div>
            </NineSlice>
          </div>
        )}

        {/* Khu vực cố định góc dưới-trái màn hình (screen-space thật — không dính world/camera):
            bảng tuyển lính (nếu đang chọn công trình) xếp ngay TRÊN minimap, cách nhau ~10px. */}
        <div
          className="absolute left-0 bottom-0 z-20 flex flex-col items-start gap-2.5"
          style={{
            paddingLeft: "max(10px, env(safe-area-inset-left))",
            paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          }}
        >
          {hasSelection && !result && !buildModeLabel && (
            <div className="rounded-xl bg-[#1c150c]/92 border border-white/10 shadow-xl px-2.5 py-2 w-[210px]">
              <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                <img src={buildingThumb(buildingRole)} className="w-5 h-5 object-contain rounded" alt="" />
                <span className="text-[11px] font-semibold text-white/90">{buildingLabel(buildingRole)}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(buildingRole === "castle" || buildingRole === "barracks") &&
                  (Object.keys(UNIT_CONFIGS) as UnitType[]).map((type) => {
                    const cfg = UNIT_CONFIGS[type];
                    const disabled = hud.gold < cfg.cost || !hud.opponentConnected || atCap;
                    return (
                      <BuildCard
                        key={type}
                        img={`/assets/ui9/unit-${type}.png`}
                        fallbackIcon="swords"
                        label={cfg.label}
                        cost={cfg.cost}
                        disabled={disabled}
                        onClick={() => spawn(type)}
                      />
                    );
                  })}

                {buildingRole === "house1" && (
                  <BuildCard
                    fallbackIcon="hammer"
                    label="+ Dân"
                    cost={VILLAGER_COST}
                    disabled={hud.gold < VILLAGER_COST || !hud.opponentConnected || hud.villagers >= hud.villagerMax}
                    onClick={spawnVillager}
                  />
                )}

                {buildingRole === "tower" && (
                  <p className="text-[10px] text-white/60 py-1 col-span-2">Tự động bắn địch trong tầm — không sản xuất.</p>
                )}
                {buildingRole === "monastery" && (
                  <p className="text-[10px] text-white/60 py-1 col-span-2">Công trình trang trí.</p>
                )}
                {buildingRole.startsWith("resource-") &&
                  (() => {
                    const kind = buildingRole.replace("resource-", "") as ResourceKind;
                    const built = hud.resourceHouses[kind];
                    if (built) {
                      return (
                        <p className="text-[10px] text-emerald-400 py-1 col-span-2">
                          ✓ Đã có nhà — dân tự khai thác mỏ {RESOURCE_LABEL[kind]} mãi mãi.
                        </p>
                      );
                    }
                    return (
                      <BuildCard
                        fallbackIcon="hammer"
                        label={`Nhà ${RESOURCE_LABEL[kind]}`}
                        cost={RESOURCE_HOUSE_COST}
                        disabled={hud.gold < RESOURCE_HOUSE_COST}
                        onClick={() => buildResourceHouse(kind)}
                      />
                    );
                  })()}

                {(buildingRole === "castle" || buildingRole === "barracks") && (
                  <BuildCard
                    img="/assets/buildings/House1_Blue.png"
                    fallbackIcon="hammer"
                    label="Xây nhà"
                    cost={HOUSE_COST}
                    disabled={hud.gold < HOUSE_COST || !hud.opponentConnected || hud.houses >= hud.housesMax}
                    onClick={buildHouse}
                  />
                )}
              </div>
              {atCap && (buildingRole === "castle" || buildingRole === "barracks") && (
                <p className="text-[9px] text-amber-400/90 mt-1">Hết chỗ quân — xây nhà hoặc khai thác thêm tài nguyên.</p>
              )}
            </div>
          )}

          {/* Minimap — HTML/SVG thật 100% screen-space, không dính camera.zoom của Phaser
              (khác bản cũ vẽ bằng Phaser Graphics: dù setScrollFactor(0) vẫn bị camera.zoom
              scale theo, gây lỗi minimap co giãn/lệch khi zoom). Kích thước CSS cố định luôn. */}
          {minimap && <MinimapPanel data={minimap} />}
        </div>

        {/* Ghi chú: gợi ý "chưa chọn gì" trước đây cố định sát đáy màn hình đã bị bỏ —
            giờ chỉ dùng đúng 1 tutorial mờ dần ở trên (24% từ đỉnh) để không che minimap/gameplay */}
      </div>
    </div>
  );
}

/** 1 ô/card building trong build menu — mờ + không bấm được nếu chưa đủ điều kiện, vẫn thấy sprite thật */
function BuildCard({
  img,
  fallbackIcon,
  label,
  cost,
  disabled,
  onClick,
}: {
  img?: string;
  fallbackIcon: string;
  label: string;
  cost: number;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-full h-[72px] rounded-lg border flex flex-col items-center justify-center gap-0.5 shadow-md transition ${
        disabled
          ? "opacity-45 grayscale bg-[#e9dcbb]/70 border-black/20"
          : "bg-[#e9dcbb]/95 border-black/30 active:scale-95 hover:bg-[#f0e5c8]"
      }`}
    >
      {img ? (
        <img src={img} className="w-8 h-8 object-contain" alt="" />
      ) : (
        <img src={icon(fallbackIcon)} className="w-6 h-6 object-contain" alt="" />
      )}
      <span className="text-[9px] font-semibold text-[#3a2c1a] leading-none text-center px-0.5">{label}</span>
      <span className="text-[9px] font-bold text-amber-800 flex items-center gap-0.5">
        <img src={icon("gold")} className="w-2.5 h-2.5" alt="" />
        {cost}
      </span>
    </button>
  );
}

function MinimapPanel({ data }: { data: MinimapData }) {
  const W = 128;
  const H = 88;
  const sx = (W - 8) / data.worldW;
  const sy = (H - 8) / data.worldH;
  const toX = (x: number) => 4 + x * sx;
  const toY = (y: number) => 4 + y * sy;

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const worldX = (px - 4) / sx;
    const worldY = (py - 4) / sy;
    gameEvents.emit("minimap-jump", { x: worldX, y: worldY });
  };

  return (
    <div
      onClick={handleClick}
      className="relative rounded-md bg-[#1a2e1a]/85 border border-[#e9dcbb]/70 shadow-lg cursor-pointer overflow-hidden"
      style={{ width: W, height: H }}
    >
      <svg width={W} height={H} className="absolute inset-0">
        <rect x={toX(data.myBase.x) - 3} y={toY(data.myBase.y) - 3} width={6} height={6} fill="#3b82f6" />
        <rect x={toX(data.enemyBase.x) - 3} y={toY(data.enemyBase.y) - 3} width={6} height={6} fill="#ef4444" />
        {data.myUnits.map((u, i) => (
          <circle key={`m${i}`} cx={toX(u.x)} cy={toY(u.y)} r={1.6} fill="#93c5fd" />
        ))}
        {data.enemyUnits.map((u, i) => (
          <circle key={`e${i}`} cx={toX(u.x)} cy={toY(u.y)} r={1.6} fill="#fca5a5" />
        ))}
        <rect
          x={toX(data.camera.x)}
          y={toY(data.camera.y)}
          width={data.camera.w * sx}
          height={data.camera.h * sy}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.5}
          opacity={0.9}
        />
      </svg>
    </div>
  );
}

function ControlGroupButton({ n }: { n: number }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(false);

  const onDown = () => {
    savedRef.current = false;
    timerRef.current = setTimeout(() => {
      savedRef.current = true;
      gameEvents.emit("control-group-save", n);
    }, 500);
  };
  const onUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!savedRef.current) gameEvents.emit("control-group-select", n);
  };

  return (
    <button
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={() => timerRef.current && clearTimeout(timerRef.current)}
      className="w-7 h-7 rounded-full bg-[#3a2c1a]/85 border border-white/30 flex items-center justify-center shadow-md active:scale-95 transition text-white text-[11px] font-bold select-none"
      title="Chạm nhanh: chọn lại — Giữ ~0.5s: lưu quân đang chọn"
    >
      {n}
    </button>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
