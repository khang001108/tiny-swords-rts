"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { randomRoomCode } from "@/game/net";
import { MAP_PRESETS, MapSize, RESOURCE_NODE_LAYOUT } from "@/game/entities";
import NineSlice from "@/components/NineSlice";

type Step = "mode" | "bot-map" | "online-choice" | "online-map";

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
      <img src="/assets/buildings/Castle_Blue.png" alt="" className="w-20 h-20 object-contain mb-1 drop-shadow-lg" />
      <h1 className="text-4xl font-extrabold mb-1 text-center tracking-wide" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.4)" }}>
        Tiny Swords RTS
      </h1>
      <p className="text-white/60 mb-6 text-center text-sm">
        Xây căn cứ, chiêu mộ quân, đấu với Bot hoặc bạn bè real-time
      </p>

      <NineSlice prefix="paper" className="w-full max-w-sm" style={{ minHeight: 0 }}>
        <div className="w-full px-6 py-7 text-[#3a2c1a]">
          {step === "mode" && (
            <div className="space-y-4">
              <BigButton color="blue" onClick={() => setStep("bot-map")}>
                🤖 Chơi với Bot
              </BigButton>
              <BigButton color="red" onClick={() => setStep("online-choice")}>
                🧑‍🤝‍🧑 Chơi với người
              </BigButton>
            </div>
          )}

          {step === "bot-map" && <MapPicker onBack={() => setStep("mode")} onPick={startBot} />}

          {step === "online-choice" && (
            <div className="space-y-4">
              <BigButton color="blue" onClick={() => setStep("online-map")}>
                Tạo phòng mới
              </BigButton>

              <div className="flex items-center gap-2 text-[#3a2c1a]/40 text-sm">
                <div className="flex-1 h-px bg-[#3a2c1a]/20" />
                hoặc
                <div className="flex-1 h-px bg-[#3a2c1a]/20" />
              </div>

              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Nhập mã phòng"
                  maxLength={6}
                  className="flex-1 px-3 py-3 rounded-lg bg-black/5 border border-[#3a2c1a]/30 outline-none uppercase tracking-widest text-center font-mono text-[#3a2c1a] placeholder:text-[#3a2c1a]/40"
                />
                <button
                  onClick={joinRoom}
                  className="px-5 py-3 rounded-lg bg-[#3a2c1a]/10 hover:bg-[#3a2c1a]/20 border border-[#3a2c1a]/30 font-semibold"
                >
                  Vào
                </button>
              </div>
              <button onClick={() => setStep("mode")} className="text-[#3a2c1a]/50 text-sm hover:text-[#3a2c1a]">
                ← Quay lại
              </button>
            </div>
          )}

          {step === "online-map" && <MapPicker onBack={() => setStep("online-choice")} onPick={createOnlineRoom} />}
        </div>
      </NineSlice>

      {step === "mode" && (
        <p className="text-white/30 text-xs mt-6 max-w-md text-center">
          Chơi với Bot để luyện tập một mình, hoặc tạo phòng rồi gửi mã cho bạn bè để đấu real-time.
        </p>
      )}
    </main>
  );
}

function BigButton({
  color,
  onClick,
  children,
}: {
  color: "blue" | "red";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="w-full h-16 block active:scale-[0.98] transition-transform">
      <NineSlice prefix={color === "blue" ? "btn-blue" : "btn-red"} className="w-full h-full">
        <span className="font-bold text-white text-lg drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">{children}</span>
      </NineSlice>
    </button>
  );
}

function MapPicker({ onBack, onPick }: { onBack: () => void; onPick: (m: MapSize) => void }) {
  const sizes: MapSize[] = ["small", "medium", "large"];
  return (
    <div className="space-y-3">
      <p className="text-[#3a2c1a]/70 text-sm text-center mb-1 flex items-center justify-center gap-1">
        <img src="/assets/ui9/icon-hammer.png" className="icon-inline" alt="" />
        Chọn kích thước bản đồ
      </p>
      {sizes.map((s) => {
        const p = MAP_PRESETS[s];
        return (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="w-full py-3 px-4 rounded-lg bg-black/5 hover:bg-black/10 border border-[#3a2c1a]/25 text-left transition flex items-center gap-3"
          >
            <MapPreviewSvg size={s} />
            <div>
              <div className="font-bold text-[#3a2c1a]">
                {p.label} <span className="text-[#3a2c1a]/40 text-xs font-normal">({p.worldW}×{p.worldH})</span>
              </div>
              <div className="text-[#3a2c1a]/55 text-xs">{p.desc}</div>
              <div className="text-[#3a2c1a]/40 text-[11px] mt-0.5">{p.buildings.length} công trình quanh căn cứ</div>
            </div>
          </button>
        );
      })}
      <button onClick={onBack} className="text-[#3a2c1a]/50 text-sm hover:text-[#3a2c1a]">
        ← Quay lại
      </button>
    </div>
  );
}

/** Xem trước bố cục bản đồ thật (vị trí căn cứ + mỏ tài nguyên) trước khi vào trận */
function MapPreviewSvg({ size }: { size: MapSize }) {
  const p = MAP_PRESETS[size];
  const W = 96;
  const H = Math.round((p.worldH / p.worldW) * W);
  const sx = W / p.worldW;
  const sy = H / p.worldH;
  const leftX = p.baseMargin * sx;
  const rightX = (p.worldW - p.baseMargin) * sx;
  const midY = (p.worldH / 2) * sy;
  const forestH = Math.max(3, 18 * sy * (p.treeSpacing < 70 ? 0.8 : 1));

  const resDot = (baseX: number, dir: 1 | -1, color: string, key: string) => {
    const spec = RESOURCE_NODE_LAYOUT.find((r) => r.kind === key)!;
    const x = baseX + dir * spec.offsetX * sx;
    const y = midY + spec.offsetY * sy;
    return <circle key={key} cx={x} cy={y} r={1.6} fill={color} />;
  };

  return (
    <svg width={W} height={H} className="rounded shrink-0 border border-black/20" style={{ background: "#4a7a4a" }}>
      <rect x={0} y={0} width={W} height={forestH} fill="#2f5a2f" />
      <rect x={0} y={H - forestH} width={W} height={forestH} fill="#2f5a2f" />
      <rect x={0} y={0} width={W} height={H} fill="none" />
      {/* căn cứ */}
      <rect x={leftX - 3} y={midY - 3} width={6} height={6} fill="#3b82f6" stroke="#1e293b" strokeWidth={0.5} />
      <rect x={rightX - 3} y={midY - 3} width={6} height={6} fill="#ef4444" stroke="#1e293b" strokeWidth={0.5} />
      {/* mỏ tài nguyên quanh mỗi base (đối xứng) */}
      {resDot(leftX, 1, "#a3752c", "wood")}
      {resDot(leftX, 1, "#facc15", "gold")}
      {resDot(leftX, 1, "#f472b6", "meat")}
      {resDot(rightX, -1, "#a3752c", "wood")}
      {resDot(rightX, -1, "#facc15", "gold")}
      {resDot(rightX, -1, "#f472b6", "meat")}
    </svg>
  );
}
