"use client";

import { useEffect, useRef, useState } from "react";
import { createPhaserGame } from "@/game/PhaserGame";
import {
  gameEvents,
  HudUpdate,
  GameEndUpdate,
  PauseState,
  BuildingSelection,
  BuildingRole,
  EndlessWaveUpdate,
} from "@/game/events";
import {
  UNIT_CONFIGS,
  UnitType,
  MapSize,
  VILLAGER_COST,
  HOUSE_COST,
  RESOURCE_HOUSE_COST,
  RESOURCE_LABEL,
  ResourceKind,
  ENDLESS_RECORD_KEY,
  PORTRAIT_W,
  PORTRAIT_H,
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
  mapSize,
}: {
  roomCode: string;
  isHost: boolean;
  mode: "bot" | "online" | "endless";
  mapSize: MapSize;
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
  const [showTutorial, setShowTutorial] = useState(true);
  const [wave, setWave] = useState(1);
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
    const t = setTimeout(() => setShowTutorial(false), 7000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = createPhaserGame(containerRef.current, roomCode, isHost, mode, mapSize);

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
    const onWave = (p: EndlessWaveUpdate) => setWave(p.wave);
    gameEvents.on("hud-update", onHud);
    gameEvents.on("game-end", onEnd);
    gameEvents.on("pause-state", onPause);
    gameEvents.on("select-building", onBuilding);
    gameEvents.on("endless-wave", onWave);

    return () => {
      gameEvents.off("hud-update", onHud);
      gameEvents.off("game-end", onEnd);
      gameEvents.off("pause-state", onPause);
      gameEvents.off("select-building", onBuilding);
      gameEvents.off("endless-wave", onWave);
      gameEvents.emit("leave-room");
      game.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, isHost, mode, mapSize]);

  const spawn = (type: UnitType) => gameEvents.emit("spawn-unit", type);
  const spawnVillager = () => gameEvents.emit("spawn-villager");
  const buildHouse = () => gameEvents.emit("build-house");
  const buildResourceHouse = (kind: ResourceKind) => gameEvents.emit("build-resource-house", kind);
  const togglePause = () => {
    gameEvents.emit("toggle-pause");
    setSettingsOpen(false);
  };

  const atCap = hud.myUnits >= hud.popCap;

  return (
    <div className="w-full mx-auto" style={{ maxWidth: 460 }}>
      {/* ══ GAME WORLD — canvas Phaser lo hết: terrain/unit/building/camera/minimap ══ */}
      <div
        ref={containerRef}
        className="relative w-full mx-auto rounded-lg overflow-hidden border border-white/10 shadow-xl touch-none select-none"
        style={{ aspectRatio: `${PORTRAIT_W} / ${PORTRAIT_H}`, maxHeight: "94vh" }}
      >
        {/* ══ SCREEN SPACE — nổi cố định trên canvas, không di chuyển theo camera ══ */}

        {/* Resource HUD — top-center */}
        <div
          className="absolute top-0 inset-x-0 flex justify-center z-20 pointer-events-none"
          style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
        >
          <div className="pointer-events-auto w-[86%] rounded-full bg-[#e9dcbb]/95 border border-black/25 shadow-md px-3 py-1.5 flex items-center justify-center gap-3 text-[#3a2c1a] text-xs flex-wrap">
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

        {/* Settings — top-right, cố định, tách khỏi resource HUD */}
        <div
          className="absolute top-0 right-0 z-30"
          style={{ paddingTop: "max(8px, env(safe-area-inset-top))", paddingRight: "max(8px, env(safe-area-inset-right))" }}
        >
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="w-9 h-9 rounded-full bg-[#3a2c1a]/85 border border-white/30 flex items-center justify-center shadow-md active:scale-95 transition"
          >
            <img src={icon("settings")} className="w-5 h-5" alt="Cài đặt" />
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

        {/* Trạng thái phòng / sóng — dưới resource HUD 1 chút, không che gameplay */}
        <div className="absolute top-11 inset-x-0 flex justify-center z-10 pointer-events-none px-3">
          <span className="text-[11px] text-white/85 bg-black/30 rounded-full px-2.5 py-0.5 drop-shadow">
            {mode === "online"
              ? `Phòng ${roomCode}`
              : mode === "endless"
              ? `🌊 Sóng ${wave}`
              : "Đấu với Bot"}
            {mode !== "endless" && (
              <span className={hud.opponentConnected ? "text-emerald-300 ml-1.5" : "text-amber-300 ml-1.5"}>
                {hud.opponentConnected ? "● đã vào" : "● đang chờ..."}
              </span>
            )}
          </span>
        </div>

        {/* Tutorial message — fade, tự ẩn khi chọn công trình đầu tiên hoặc sau vài giây */}
        {showTutorial && !result && (
          <div className="absolute top-20 inset-x-4 z-10 flex justify-center pointer-events-none animate-[fadeIn_0.4s_ease]">
            <div className="pointer-events-auto max-w-[88%] bg-black/55 text-white text-xs text-center rounded-lg px-3 py-2 shadow-lg border border-white/10">
              💡 Bấm vào <b>Lâu đài</b> để xây dựng và tuyển quân — bấm lính rồi bấm nơi muốn tới để ra lệnh.
            </div>
          </div>
        )}

        {/* Tạm dừng */}
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

        {/* Kết quả trận đấu */}
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

        {/* ══ ACTION PANEL — chỉ hiện sau khi đã bấm chọn 1 công trình, đặt ở đáy màn hình ══ */}
        {hasSelection && !result && (
          <div
            className="absolute bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none"
            style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
          >
            <div className="pointer-events-auto w-full mx-2 rounded-xl bg-[#1c150c]/90 border border-white/10 shadow-xl px-2.5 py-2">
              <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                <img src={buildingThumb(buildingRole)} className="w-6 h-6 object-contain rounded" alt="" />
                <span className="text-xs font-semibold text-white/90">{buildingLabel(buildingRole)}</span>
              </div>

              <div className="flex gap-1.5 flex-wrap items-center">
                {(buildingRole === "castle" || buildingRole === "barracks") &&
                  (Object.keys(UNIT_CONFIGS) as UnitType[]).map((type) => {
                    const cfg = UNIT_CONFIGS[type];
                    const disabled = hud.gold < cfg.cost || !hud.opponentConnected || atCap;
                    return (
                      <button
                        key={type}
                        onClick={() => spawn(type)}
                        disabled={disabled}
                        className={`h-12 min-w-[100px] flex-1 transition ${disabled ? "opacity-40 grayscale" : "active:scale-[0.97]"}`}
                      >
                        <NineSlice prefix="btn-blue" className="w-full h-full">
                          <span className="font-semibold text-white text-xs px-1.5 flex items-center gap-1 drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                            {cfg.label}
                            <span className="inline-flex items-center opacity-90">
                              <img src={icon("gold")} className="icon-inline m-0" alt="" />
                              {cfg.cost}
                            </span>
                          </span>
                        </NineSlice>
                      </button>
                    );
                  })}

                {buildingRole === "house1" && (
                  <button
                    onClick={spawnVillager}
                    disabled={hud.gold < VILLAGER_COST || !hud.opponentConnected || hud.villagers >= hud.villagerMax}
                    className={`h-12 flex-1 min-w-[120px] transition ${
                      hud.gold < VILLAGER_COST || !hud.opponentConnected || hud.villagers >= hud.villagerMax
                        ? "opacity-40 grayscale"
                        : "active:scale-[0.97]"
                    }`}
                  >
                    <NineSlice prefix="btn-red" className="w-full h-full">
                      <span className="font-semibold text-white text-xs px-1.5 flex items-center gap-1 drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                        + Dân
                        <span className="inline-flex items-center opacity-90">
                          <img src={icon("gold")} className="icon-inline m-0" alt="" />
                          {VILLAGER_COST}
                        </span>
                      </span>
                    </NineSlice>
                  </button>
                )}

                {buildingRole === "tower" && (
                  <p className="text-[11px] text-white/60 py-1">Tháp canh tự động bắn địch trong tầm — không sản xuất.</p>
                )}
                {buildingRole === "monastery" && (
                  <p className="text-[11px] text-white/60 py-1">Tu viện — công trình trang trí.</p>
                )}
                {buildingRole.startsWith("resource-") &&
                  (() => {
                    const kind = buildingRole.replace("resource-", "") as ResourceKind;
                    const built = hud.resourceHouses[kind];
                    if (built) {
                      return (
                        <p className="text-[11px] text-emerald-400 py-1">
                          ✓ Đã có nhà — dân tự khai thác mỏ {RESOURCE_LABEL[kind]} mãi mãi.
                        </p>
                      );
                    }
                    const disabled = hud.gold < RESOURCE_HOUSE_COST;
                    return (
                      <button
                        onClick={() => buildResourceHouse(kind)}
                        disabled={disabled}
                        className={`h-12 flex-1 min-w-[170px] transition ${disabled ? "opacity-40 grayscale" : "active:scale-[0.97]"}`}
                      >
                        <NineSlice prefix="btn-red" className="w-full h-full">
                          <span className="font-semibold text-white text-xs px-1.5 flex items-center gap-1 drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                            Xây nhà cạnh mỏ {RESOURCE_LABEL[kind]}
                            <span className="inline-flex items-center opacity-90">
                              <img src={icon("gold")} className="icon-inline m-0" alt="" />
                              {RESOURCE_HOUSE_COST}
                            </span>
                          </span>
                        </NineSlice>
                      </button>
                    );
                  })()}

                <button
                  onClick={buildHouse}
                  disabled={hud.gold < HOUSE_COST || !hud.opponentConnected || hud.houses >= hud.housesMax}
                  className={`h-12 flex-1 min-w-[120px] transition ${
                    hud.gold < HOUSE_COST || !hud.opponentConnected || hud.houses >= hud.housesMax
                      ? "opacity-40 grayscale"
                      : "active:scale-[0.97]"
                  }`}
                >
                  <NineSlice prefix="btn-red" className="w-full h-full">
                    <span className="font-semibold text-white text-xs px-1.5 flex items-center gap-1 drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                      Xây nhà ({hud.houses}/{hud.housesMax})
                      <span className="inline-flex items-center opacity-90">
                        <img src={icon("gold")} className="icon-inline m-0" alt="" />
                        {HOUSE_COST}
                      </span>
                    </span>
                  </NineSlice>
                </button>
              </div>
              {atCap && (
                <p className="text-[10px] text-amber-400/90 mt-1">
                  Hết chỗ quân — xây nhà dân hoặc khai thác thêm Gỗ/Thịt để nới giới hạn.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Gợi ý khi chưa chọn gì — thay cho action panel */}
        {!hasSelection && !result && (
          <div
            className="absolute bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none"
            style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
          >
            <div className="text-[11px] text-white/70 bg-black/40 rounded-full px-3 py-1.5">
              Bấm vào Lâu đài trên bản đồ để bắt đầu xây dựng
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
