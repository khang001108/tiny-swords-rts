"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { randomRoomCode } from "@/game/net";
import { MAP_PRESETS, MapSize } from "@/game/entities";

type Step = "mode" | "bot-map" | "online-choice" | "online-map" | "online-join";

export default function LobbyPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mode");
  const [joinCode, setJoinCode] = useState("");

  const startBot = (map: MapSize) => {
    const id = Math.random().toString(36).slice(2, 8);
    router.push(`/game/bot-${id}?mode=bot&map=${map}`);
  };

  const createOnlineRoom = (map: MapSize) => {
    const code = randomRoomCode(map);
    router.push(`/game/${code}?host=1&mode=online`);
  };

  const joinRoom = () => {
    if (joinCode.trim().length < 5) return;
    router.push(`/game/${joinCode.trim().toUpperCase()}?host=0&mode=online`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-extrabold mb-1 text-center">⚔️ Tiny Swords RTS</h1>
      <p className="text-white/60 mb-8 text-center">Xây căn cứ, chiêu mộ quân, đấu với Bot hoặc bạn bè real-time</p>

      <div className="w-full max-w-sm space-y-4">
        {step === "mode" && (
          <>
            <button
              onClick={() => setStep("bot-map")}
              className="w-full py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-lg transition"
            >
              🤖 Chơi với Bot
            </button>
            <button
              onClick={() => setStep("online-choice")}
              className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-lg transition"
            >
              🧑‍🤝‍🧑 Chơi với người
            </button>
          </>
        )}

        {step === "bot-map" && (
          <MapPicker onBack={() => setStep("mode")} onPick={startBot} />
        )}

        {step === "online-choice" && (
          <>
            <button
              onClick={() => setStep("online-map")}
              className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-lg transition"
            >
              Tạo phòng mới
            </button>

            <div className="flex items-center gap-2 text-white/40 text-sm">
              <div className="flex-1 h-px bg-white/10" />
              hoặc
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Nhập mã phòng"
                maxLength={6}
                className="flex-1 px-3 py-3 rounded-lg bg-white/10 border border-white/20 outline-none uppercase tracking-widest text-center font-mono"
              />
              <button
                onClick={joinRoom}
                className="px-5 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 font-semibold"
              >
                Vào
              </button>
            </div>
            <button onClick={() => setStep("mode")} className="text-white/40 text-sm hover:text-white/70">
              ← Quay lại
            </button>
          </>
        )}

        {step === "online-map" && (
          <MapPicker onBack={() => setStep("online-choice")} onPick={createOnlineRoom} />
        )}
      </div>

      {step === "mode" && (
        <p className="text-white/30 text-xs mt-10 max-w-md text-center">
          Chơi với Bot để luyện tập một mình, hoặc tạo phòng rồi gửi mã cho bạn bè để đấu real-time.
        </p>
      )}
    </main>
  );
}

function MapPicker({ onBack, onPick }: { onBack: () => void; onPick: (m: MapSize) => void }) {
  const sizes: MapSize[] = ["small", "medium", "large"];
  return (
    <div className="space-y-3">
      <p className="text-white/60 text-sm text-center mb-1">Chọn kích thước bản đồ</p>
      {sizes.map((s) => {
        const p = MAP_PRESETS[s];
        return (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="w-full py-3 px-4 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-left transition"
          >
            <div className="font-bold">
              {p.label} <span className="text-white/40 text-xs font-normal">({p.worldW}×{p.worldH})</span>
            </div>
            <div className="text-white/50 text-xs">{p.desc}</div>
          </button>
        );
      })}
      <button onClick={onBack} className="text-white/40 text-sm hover:text-white/70">
        ← Quay lại
      </button>
    </div>
  );
}
