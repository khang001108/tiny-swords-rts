"use client";

import { useEffect, useRef, useState } from "react";
import { createPhaserGame } from "@/game/PhaserGame";
import { gameEvents, HudUpdate, GameEndUpdate } from "@/game/events";
import { UNIT_CONFIGS, UnitType, MapSize, MAP_PRESETS, VILLAGER_COST } from "@/game/entities";
import NineSlice from "@/components/NineSlice";

export default function GameCanvas({
  roomCode,
  isHost,
  mode,
  mapSize,
}: {
  roomCode: string;
  isHost: boolean;
  mode: "bot" | "online";
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
  });
  const [result, setResult] = useState<GameEndUpdate | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = createPhaserGame(containerRef.current, roomCode, isHost, mode, mapSize);

    const onHud = (p: HudUpdate) => setHud(p);
    const onEnd = (p: GameEndUpdate) => setResult(p);
    gameEvents.on("hud-update", onHud);
    gameEvents.on("game-end", onEnd);

    return () => {
      gameEvents.off("hud-update", onHud);
      gameEvents.off("game-end", onEnd);
      gameEvents.emit("leave-room");
      game.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, isHost, mode, mapSize]);

  const spawn = (type: UnitType) => gameEvents.emit("spawn-unit", type);
  const spawnVillager = () => gameEvents.emit("spawn-villager");
  const preset = MAP_PRESETS[mapSize];
  const icon = (name: string) => `/assets/ui9/icon-${name}.png`;

  return (
    <div className="w-full mx-auto" style={{ maxWidth: preset.worldW }}>
      <div className="rounded-lg bg-[#e9dcbb]/95 border border-black/20 shadow-md mb-2 px-3 py-1.5 flex items-center justify-between text-sm text-[#3a2c1a] flex-wrap gap-x-3 gap-y-1">
        {mode === "online" ? (
          <span>
            Phòng: <span className="font-mono font-bold">{roomCode}</span>
          </span>
        ) : (
          <span className="text-[#3a2c1a]/60">Chế độ: Đấu với Bot</span>
        )}
        <span>
          {hud.opponentConnected ? (
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
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 px-1">
        <BaseBar label="Căn cứ của bạn" hp={hud.myBaseHp} max={hud.myBaseMaxHp} color="bg-blue-500" icon={icon("shield")} />
        <BaseBar
          label="Căn cứ đối thủ"
          hp={hud.enemyBaseHp}
          max={hud.enemyBaseMaxHp}
          color="bg-red-500"
          icon={icon("shield")}
          align="right"
        />
      </div>

      <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden border border-white/10 shadow-xl">
        {result && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
            <NineSlice prefix="paper" style={{ width: 340, height: 220 }}>
              <div className="flex flex-col items-center gap-3 px-4">
                <div className={`text-3xl font-extrabold ${result.youWin ? "text-emerald-700" : "text-red-700"}`}>
                  {result.youWin ? "🏆 BẠN THẮNG!" : "💀 BẠN THUA"}
                </div>
                <a href="/" className="w-40 h-12 block">
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

      <div className="flex gap-2 mt-3 px-1 flex-wrap items-center">
        {(Object.keys(UNIT_CONFIGS) as UnitType[]).map((type) => {
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

        <div className="w-px h-10 bg-white/15 mx-1" />

        <button
          onClick={spawnVillager}
          disabled={hud.gold < VILLAGER_COST || !hud.opponentConnected || hud.villagers >= hud.villagerMax}
          className={`h-14 min-w-[130px] transition ${
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
      </div>
      {hud.myUnits >= hud.popCap && (
        <p className="text-xs text-amber-400/80 mt-1 px-1">
          Đã đạt giới hạn quân số — cho dân khai thác thêm Gỗ/Thịt hoặc xây thêm công trình (bản đồ lớn hơn) để tăng giới hạn.
        </p>
      )}
    </div>
  );
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
