"use client";

import { useEffect, useRef, useState } from "react";
import { createPhaserGame } from "@/game/PhaserGame";
import { gameEvents, HudUpdate, GameEndUpdate } from "@/game/events";
import { UNIT_CONFIGS, UnitType, MapSize, MAP_PRESETS } from "@/game/entities";

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
    myBaseHp: 1,
    myBaseMaxHp: 1,
    enemyBaseHp: 1,
    enemyBaseMaxHp: 1,
    opponentConnected: false,
    myUnits: 0,
    popCap: 6,
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
  const preset = MAP_PRESETS[mapSize];

  return (
    <div className="w-full mx-auto" style={{ maxWidth: preset.worldW }}>
      <div className="flex items-center justify-between mb-2 px-1 text-sm text-white/90 flex-wrap gap-1">
        {mode === "online" ? (
          <span>
            Phòng: <span className="font-mono font-bold">{roomCode}</span>
          </span>
        ) : (
          <span className="text-white/60">Chế độ: Đấu với Bot</span>
        )}
        <span>
          {hud.opponentConnected ? (
            <span className="text-emerald-400">● Đối thủ đã vào</span>
          ) : (
            <span className="text-amber-400">● Đang chờ đối thủ...</span>
          )}
        </span>
        <span className="text-white/70">
          Quân: {hud.myUnits}/{hud.popCap}
        </span>
        <span>
          Vàng: <span className="font-bold text-yellow-300">{hud.gold}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 px-1">
        <BaseBar label="Căn cứ của bạn" hp={hud.myBaseHp} max={hud.myBaseMaxHp} color="bg-blue-500" />
        <BaseBar label="Căn cứ đối thủ" hp={hud.enemyBaseHp} max={hud.enemyBaseMaxHp} color="bg-red-500" align="right" />
      </div>

      <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden border border-white/10 shadow-xl">
        {result && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <div className={`text-4xl font-extrabold mb-2 ${result.youWin ? "text-emerald-400" : "text-red-400"}`}>
                {result.youWin ? "🏆 BẠN THẮNG!" : "💀 BẠN THUA"}
              </div>
              <a
                href="/"
                className="inline-block mt-3 px-4 py-2 rounded bg-white text-black font-semibold hover:bg-gray-200"
              >
                Về sảnh chờ
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3 px-1 flex-wrap">
        {(Object.keys(UNIT_CONFIGS) as UnitType[]).map((type) => {
          const cfg = UNIT_CONFIGS[type];
          const atCap = hud.myUnits >= hud.popCap;
          const disabled = hud.gold < cfg.cost || !hud.opponentConnected || atCap;
          return (
            <button
              key={type}
              onClick={() => spawn(type)}
              disabled={disabled}
              className={`px-4 py-2 rounded-lg font-semibold border transition ${
                disabled
                  ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
                  : "bg-amber-500/90 border-amber-300 text-black hover:bg-amber-400"
              }`}
            >
              {cfg.label} <span className="text-xs opacity-70">({cfg.cost}💰)</span>
            </button>
          );
        })}
      </div>
      {hud.myUnits >= hud.popCap && (
        <p className="text-xs text-amber-400/80 mt-1 px-1">
          Đã đạt giới hạn quân số — xây thêm doanh trại (bản đồ lớn hơn) để tăng giới hạn, hoặc chờ quân hiện tại giao chiến.
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
  align = "left",
}: {
  label: string;
  hp: number;
  max: number;
  color: string;
  align?: "left" | "right";
}) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="text-xs text-white/70 mb-0.5">
        {label} — {Math.ceil(hp)}/{max}
      </div>
      <div className="h-2 w-full bg-white/10 rounded overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${pct}%`, marginLeft: align === "right" ? `${100 - pct}%` : 0 }}
        />
      </div>
    </div>
  );
}
