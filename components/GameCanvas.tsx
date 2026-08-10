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
  castle: "🏰 Lâu đài",
  barracks: "⚔️ Doanh trại",
  tower: "🗼 Tháp canh",
  house1: "🏠 Nhà dân",
  monastery: "⛪ Tu viện",
};
function buildingLabel(role: BuildingRole): string {
  if (role.startsWith("resource-")) {
    const kind = role.replace("resource-", "") as ResourceKind;
    return `🌾 Mỏ ${RESOURCE_LABEL[kind]}`;
  }
  return BUILDING_LABEL[role as Exclude<BuildingRole, `resource-${ResourceKind}`>];
}

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
  const [buildingRole, setBuildingRole] = useState<BuildingRole>("castle");
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
    const onBuilding = (p: BuildingSelection) => setBuildingRole(p.role);
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
  const togglePause = () => gameEvents.emit("toggle-pause");
  const preset = MAP_PRESETS[mapSize];
  const icon = (name: string) => `/assets/ui9/icon-${name}.png`;

  return (
    <div className="w-full mx-auto" style={{ maxWidth: preset.worldW }}>
      <div className="rounded-lg bg-[#e9dcbb]/95 border border-black/20 shadow-md mb-2 px-3 py-1.5 flex items-center justify-between text-sm text-[#3a2c1a] flex-wrap gap-x-3 gap-y-1">
        {mode === "online" ? (
          <span>
            Phòng: <span className="font-mono font-bold">{roomCode}</span>
          </span>
        ) : mode === "endless" ? (
          <span className="text-[#3a2c1a]/60 flex items-center gap-1">🌊 Endless Mode</span>
        ) : (
          <span className="text-[#3a2c1a]/60">Chế độ: Đấu với Bot</span>
        )}
        <span>
          {mode === "endless" ? (
            <span className="text-emerald-700 font-medium">Sóng {wave}</span>
          ) : hud.opponentConnected ? (
            <span className="text-emerald-700 font-medium">● Đối thủ đã vào</span>
          ) : (
            <span className="text-amber-700 font-medium">● Đang chờ đối thủ...</span>
          )}
        </span>
        <span className="flex items-center font-medium">
          <img src={icon("swords")} className="icon-inline" alt="" />
          {hud.myUnits}/{hud.popCap}
        </span>
        <span className="flex items-center font-medium">
          <img src={icon("hammer")} className="icon-inline" alt="" />
          Dân {hud.villagers}/{hud.villagerMax}
        </span>
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
        <button
          onClick={togglePause}
          className="ml-auto px-2.5 py-1 rounded bg-[#3a2c1a]/10 hover:bg-[#3a2c1a]/20 border border-[#3a2c1a]/30 text-xs font-semibold flex items-center gap-1"
          title={mode === "online" ? "Chỉ tạm dừng phía bạn — đối thủ vẫn tiếp tục" : "Tạm dừng"}
        >
          <img src={icon(paused ? "play" : "settings")} className="icon-inline m-0" alt="" />
          {paused ? "Tiếp tục" : "Tạm dừng"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 px-1">
        <BaseBar label="Căn cứ của bạn" hp={hud.myBaseHp} max={hud.myBaseMaxHp} color="bg-blue-500" icon={icon("shield")} />
        {mode === "endless" ? (
          <div className="text-right">
            <div className="text-xs text-white/70 mb-0.5">Kỷ lục</div>
            <div className="text-sm font-bold text-amber-300">
              {bestRecord ? `Sóng ${bestRecord.wave} · ${formatTime(bestRecord.timeSec)}` : "Chưa có"}
            </div>
          </div>
        ) : (
          <BaseBar
            label="Căn cứ đối thủ"
            hp={hud.enemyBaseHp}
            max={hud.enemyBaseMaxHp}
            color="bg-red-500"
            icon={icon("shield")}
            align="right"
          />
        )}
      </div>

      <div
        ref={containerRef}
        className="relative w-full mx-auto rounded-lg overflow-hidden border border-white/10 shadow-xl"
        style={{ aspectRatio: `${preset.worldW} / ${preset.worldH}`, maxHeight: "68vh" }}
      >
        {paused && !result && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
            <NineSlice prefix="paper" style={{ width: 340, height: mode === "endless" ? 260 : 220 }}>
              <div className="flex flex-col items-center gap-2 px-4">
                <div className={`text-3xl font-extrabold ${result.youWin ? "text-emerald-700" : "text-red-700"}`}>
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
      </div>

      <div className="flex items-center gap-2 mt-3 px-1">
        <span className="text-xs text-white/60 flex items-center gap-1">
          Đang chọn: <span className="font-semibold text-white/90">{buildingLabel(buildingRole)}</span>
        </span>
      </div>

      <div className="flex gap-2 mt-1.5 px-1 flex-wrap items-center">
        {(buildingRole === "castle" || buildingRole === "barracks") &&
          (Object.keys(UNIT_CONFIGS) as UnitType[]).map((type) => {
            const cfg = UNIT_CONFIGS[type];
            const atCap = hud.myUnits >= hud.popCap;
            const disabled = hud.gold < cfg.cost || !hud.opponentConnected || atCap;
            return (
              <button
                key={type}
                onClick={() => spawn(type)}
                disabled={disabled}
                className={`h-14 min-w-[130px] transition ${disabled ? "opacity-40 grayscale" : "active:scale-[0.97]"}`}
              >
                <NineSlice prefix="btn-blue" className="w-full h-full">
                  <span className="font-semibold text-white text-sm px-2 flex items-center gap-1 drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                    {cfg.label}
                    <span className="inline-flex items-center text-xs opacity-90">
                      <img src={icon("gold")} className="icon-inline" alt="" />
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
            className={`h-14 min-w-[140px] transition ${
              hud.gold < VILLAGER_COST || !hud.opponentConnected || hud.villagers >= hud.villagerMax
                ? "opacity-40 grayscale"
                : "active:scale-[0.97]"
            }`}
          >
            <NineSlice prefix="btn-red" className="w-full h-full">
              <span className="font-semibold text-white text-sm px-2 flex items-center gap-1 drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                + Dân
                <span className="inline-flex items-center text-xs opacity-90">
                  <img src={icon("gold")} className="icon-inline" alt="" />
                  {VILLAGER_COST}
                </span>
              </span>
            </NineSlice>
          </button>
        )}

        {buildingRole === "tower" && (
          <p className="text-xs text-white/50 py-2">Tháp canh tự động bắn quân địch trong tầm — không sản xuất được.</p>
        )}
        {buildingRole === "monastery" && (
          <p className="text-xs text-white/50 py-2">Tu viện — công trình trang trí, chưa có chức năng sản xuất.</p>
        )}
        {buildingRole.startsWith("resource-") &&
          (() => {
            const kind = buildingRole.replace("resource-", "") as ResourceKind;
            const built = hud.resourceHouses[kind];
            if (built) {
              return (
                <p className="text-xs text-emerald-400 py-2">
                  ✓ Đã có nhà cạnh mỏ {RESOURCE_LABEL[kind]} — 1 dân được cấp miễn phí, tự động khai thác ở đây mãi mãi.
                </p>
              );
            }
            const disabled = hud.gold < RESOURCE_HOUSE_COST;
            return (
              <button
                onClick={() => buildResourceHouse(kind)}
                disabled={disabled}
                className={`h-14 min-w-[190px] transition ${disabled ? "opacity-40 grayscale" : "active:scale-[0.97]"}`}
              >
                <NineSlice prefix="btn-red" className="w-full h-full">
                  <span className="font-semibold text-white text-sm px-2 flex items-center gap-1 drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                    🏠 Xây nhà cạnh mỏ {RESOURCE_LABEL[kind]}
                    <span className="inline-flex items-center text-xs opacity-90">
                      <img src={icon("gold")} className="icon-inline" alt="" />
                      {RESOURCE_HOUSE_COST}
                    </span>
                  </span>
                </NineSlice>
              </button>
            );
          })()}

        <div className="w-px h-10 bg-white/15 mx-1" />

        <button
          onClick={buildHouse}
          disabled={hud.gold < HOUSE_COST || !hud.opponentConnected || hud.houses >= hud.housesMax}
          className={`h-14 min-w-[150px] transition ${
            hud.gold < HOUSE_COST || !hud.opponentConnected || hud.houses >= hud.housesMax
              ? "opacity-40 grayscale"
              : "active:scale-[0.97]"
          }`}
        >
          <NineSlice prefix="btn-red" className="w-full h-full">
            <span className="font-semibold text-white text-sm px-2 flex items-center gap-1 drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
              🏠 Xây nhà ({hud.houses}/{hud.housesMax})
              <span className="inline-flex items-center text-xs opacity-90">
                <img src={icon("gold")} className="icon-inline" alt="" />
                {HOUSE_COST}
              </span>
            </span>
          </NineSlice>
        </button>
      </div>
      {hud.myUnits >= hud.popCap && (
        <p className="text-xs text-amber-400/80 mt-1 px-1">
          Đã đạt giới hạn quân số — xây thêm nhà dân hoặc để dân khai thác thêm Gỗ/Thịt để nới giới hạn.
        </p>
      )}
      <p className="text-xs text-white/40 mt-1 px-1">
        💡 Bấm vào 1 công trình của bạn (Lâu đài/Doanh trại/Nhà dân) để chọn nơi sản xuất. Bấm vào 1 mỏ tài nguyên (cây/mỏ
        vàng/cừu) khi chưa chọn gì để xây nhà ngay cạnh đó — dân được cấp sẽ tự động khai thác đúng mỏ đó mãi mãi. Bấm
        lính/dân rồi bấm nơi muốn tới để ra lệnh.
      </p>
    </div>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function BaseBar({
  label,
  hp,
  max,
  color,
  icon,
  align = "left",
}: {
  label: string;
  hp: number;
  max: number;
  color: string;
  icon: string;
  align?: "left" | "right";
}) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className={`text-xs text-white/70 mb-0.5 flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {align === "left" && <img src={icon} className="icon-inline" alt="" />}
        {label} — {Math.ceil(hp)}/{max}
        {align === "right" && <img src={icon} className="icon-inline" alt="" />}
      </div>
      <div className="h-2.5 w-full bg-white/10 rounded overflow-hidden border border-black/20">
        <div
          className={`h-full ${color}`}
          style={{ width: `${pct}%`, marginLeft: align === "right" ? `${100 - pct}%` : 0 }}
        />
      </div>
    </div>
  );
}
