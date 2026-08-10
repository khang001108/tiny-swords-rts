"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import NineSlice from "@/components/NineSlice";
import { FACTION_COLORS, FACTION_HEX, FACTION_LABEL, FactionColor } from "@/game/entities";

const FfaCanvas = dynamic(() => import("@/components/FfaCanvas"), {
  ssr: false,
  loading: () => <div className="w-full h-[500px] flex items-center justify-center text-white/50">Đang tải trận đấu...</div>,
});

type Step = "color" | "bots" | "play";

export default function FfaPage() {
  const [step, setStep] = useState<Step>("color");
  const [color, setColor] = useState<FactionColor | null>(null);
  const [botCount, setBotCount] = useState(2);

  if (step === "play" && color) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center py-6 px-2">
        <FfaCanvas playerColor={color} botCount={botCount} />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-6 relative"
      style={{ backgroundImage: "url(/assets/ui9/lobby_bg.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
      <div className="relative z-10 w-full flex flex-col items-center">
      <h1 className="text-3xl font-extrabold mb-1 text-center text-white" style={{ textShadow: "0 2px 0 rgba(0,0,0,0.6), 0 0 18px rgba(0,0,0,0.5)" }}>
        ⚔️ Đấu 1 chọi nhiều
      </h1>
      <p className="text-white/80 mb-6 text-center text-sm drop-shadow">Chọn phe của bạn rồi chọn số AI muốn đối đầu (tối đa 4)</p>

      <NineSlice prefix="paper" className="w-full max-w-md">
        <div className="w-full px-6 py-7 text-[#3a2c1a]">
          {step === "color" && (
            <div>
              <p className="text-center text-sm mb-4 font-semibold">Chọn màu phe của bạn</p>
              <div className="grid grid-cols-5 gap-3">
                {FACTION_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setColor(c);
                      setStep("bots");
                    }}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <span
                      className="w-12 h-12 rounded-full border-2 border-[#3a2c1a]/30 group-hover:border-[#3a2c1a] group-active:scale-95 transition shadow-inner"
                      style={{ background: `#${FACTION_HEX[c].toString(16).padStart(6, "0")}` }}
                    />
                    <span className="text-[11px] text-[#3a2c1a]/70">{FACTION_LABEL[c]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "bots" && color && (
            <div className="space-y-4">
              <p className="text-center text-sm font-semibold">
                Phe của bạn:{" "}
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ background: `#${FACTION_HEX[color].toString(16).padStart(6, "0")}` }}
                  />
                  {FACTION_LABEL[color]}
                </span>
              </p>
              <p className="text-center text-xs text-[#3a2c1a]/60 mb-1">Chọn số lượng AI đối đầu</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBotCount(n)}
                    className={`py-3 rounded-lg border font-bold transition ${
                      botCount === n
                        ? "bg-[#3a2c1a] text-white border-[#3a2c1a]"
                        : "bg-black/5 border-[#3a2c1a]/25 hover:bg-black/10"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={() => setStep("play")} className="w-full h-14 block mt-2">
                <NineSlice prefix="btn-blue" className="w-full h-full">
                  <span className="font-bold text-white">Bắt đầu trận đấu</span>
                </NineSlice>
              </button>
              <button onClick={() => setStep("color")} className="text-[#3a2c1a]/50 text-sm hover:text-[#3a2c1a] block mx-auto">
                ← Đổi màu phe
              </button>
            </div>
          )}
        </div>
      </NineSlice>

      <a href="/" className="text-white/60 text-sm mt-6 hover:text-white/90 drop-shadow">
        ← Về sảnh chờ
      </a>
      </div>
    </main>
  );
}
