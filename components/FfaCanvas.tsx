"use client";

import { useEffect, useRef, useState } from "react";
import { createFfaGame } from "@/game/FfaGame";
import { gameEvents, FfaHudUpdate, GameEndUpdate, PauseState } from "@/game/events";
import { FactionColor, FACTION_HEX, FACTION_LABEL, FFA_UNIT_TYPES, FfaUnitType, UNIT_CONFIGS, FFA_WORLD_W, FFA_WORLD_H } from "@/game/entities";
import NineSlice from "@/components/NineSlice";

export default function FfaCanvas({ playerColor, botCount }: { playerColor: FactionColor; botCount: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<FfaHudUpdate>({
    gold: 0,
    myUnits: 0,
    popCap: 10,
    myBaseHp: 1,
    myBaseMaxHp: 1,
    enemyBases: [],
  });
  const [result, setResult] = useState<GameEndUpdate | null>(null);
  const [paused, setPaused] = useState(false);
  const icon = (name: string) => `/assets/ui9/icon-${name}.png`;

  useEffect(() => {
    if (!containerRef.current) return;
    const game = createFfaGame(containerRef.current, playerColor, botCount);

    const onHud = (p: FfaHudUpdate) => setHud(p);
    const onEnd = (p: GameEndUpdate) => setResult(p);
    const onPause = (p: PauseState) => setPaused(p.paused);
    gameEvents.on("ffa-hud-update", onHud);
    gameEvents.on("game-end", onEnd);
    gameEvents.on("pause-state", onPause);

    return () => {
      gameEvents.off("ffa-hud-update", onHud);
      gameEvents.off("game-end", onEnd);
      gameEvents.off("pause-state", onPause);
      gameEvents.emit("leave-room");
      game.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerColor, botCount]);

  const spawn = (type: FfaUnitType) => gameEvents.emit("ffa-spawn-unit", type);
  const togglePause = () => gameEvents.emit("ffa-toggle-pause");

  return (
    <div className="w-full mx-auto" style={{ maxWidth: FFA_WORLD_W }}>
      <div className="rounded-lg bg-[#e9dcbb]/95 border border-black/20 shadow-md mb-2 px-3 py-1.5 flex items-center justify-between text-sm text-[#3a2c1a] flex-wrap gap-x-3 gap-y-1">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: hexToCss(FACTION_HEX[playerColor]) }} />
          Phe của bạn: {FACTION_LABEL[playerColor]} — đấu {botCount} AI
        </span>
        <span className="flex items-center font-medium">
          <img src={icon("swords")} className="icon-inline" alt="" />
          {hud.myUnits}/{hud.popCap}
        </span>
        <span className="flex items-center font-bold text-amber-700">
          <img src={icon("gold")} className="icon-inline" alt="" />
          {hud.gold}
        </span>
        <button
          onClick={togglePause}
          className="ml-auto px-2.5 py-1 rounded bg-[#3a2c1a]/10 hover:bg-[#3a2c1a]/20 border border-[#3a2c1a]/30 text-xs font-semibold"
        >
          {paused ? "▶ Tiếp tục" : "⏸ Tạm dừng"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 px-1">
        <div>
          <div className="text-xs text-white/70 mb-0.5 flex items-center gap-1">
            <img src={icon("shield")} className="icon-inline" alt="" />
            Căn cứ của bạn — {Math.ceil(hud.myBaseHp)}/{hud.myBaseMaxHp}
          </div>
          <div className="h-2.5 w-full bg-white/10 rounded overflow-hidden border border-black/20">
            <div
              className="h-full"
              style={{ width: `${Math.max(0, (hud.myBaseHp / hud.myBaseMaxHp) * 100)}%`, background: hexToCss(FACTION_HEX[playerColor]) }}
            />
          </div>
        </div>
        <div className="space-y-1">
          {hud.enemyBases.map((b, i) => (
            <div key={i} className={b.alive ? "" : "opacity-30"}>
              <div className="text-[10px] text-white/60 flex items-center justify-between">
                <span>{FACTION_LABEL[b.color as FactionColor] ?? b.color}</span>
                <span>{b.alive ? `${Math.ceil(b.hp)}/${b.maxHp}` : "Đã hạ"}</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded overflow-hidden border border-black/20">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(0, (b.hp / b.maxHp) * 100)}%`,
                    background: hexToCss(FACTION_HEX[b.color as FactionColor] ?? 0xffffff),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full mx-auto rounded-lg overflow-hidden border border-white/10 shadow-xl"
        style={{ aspectRatio: `${FFA_WORLD_W} / ${FFA_WORLD_H}`, maxHeight: "68vh" }}
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
            </div>
          </div>
        )}
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
        {FFA_UNIT_TYPES.map((type) => {
          const cfg = UNIT_CONFIGS[type];
          const disabled = hud.gold < (cfg.cost.gold ?? 0) || hud.myUnits >= hud.popCap;
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
                    {cfg.cost.gold ?? 0}
                  </span>
                </span>
              </NineSlice>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-white/40 mt-2 px-1">
        💡 Quân của bạn đứng yên chờ lệnh — bấm chọn rồi bấm nơi muốn tới hoặc bấm căn cứ/quân địch để tấn công. {botCount}{" "}
        AI sẽ tự tấn công căn cứ bạn — hạ hết căn cứ địch để thắng.
      </p>
    </div>
  );
}

function hexToCss(hex: number) {
  return `#${hex.toString(16).padStart(6, "0")}`;
}
