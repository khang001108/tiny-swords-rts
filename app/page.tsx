"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { randomRoomCode } from "@/game/net";
import { MAP_PRESETS, MapSize, RESOURCE_NODE_LAYOUT, sliderToMapSize } from "@/game/entities";
import NineSlice from "@/components/NineSlice";

type Step = "mode" | "bot-map" | "online-choice" | "online-map" | "endless-map";

export default function LobbyPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mode");
  const [joinCode, setJoinCode] = useState("");

  const startBot = (map: MapSize) => {
    const id = Math.random().toString(36).slice(2, 8);
    router.push(`/game/bot-${id}?mode=bot&map=${map}`);
  };

  const startEndless = (map: MapSize) => {
    const id = Math.random().toString(36).slice(2, 8);
    router.push(`/game/endless-${id}?mode=endless&map=${map}`);
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
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-6 relative"
      style={{
        backgroundImage: "url(/assets/ui9/lobby_bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
      <div className="relative z-10 w-full flex flex-col items-center">
        <img src="/assets/buildings/Castle_Blue.png" alt="" className="w-20 h-20 object-contain mb-1 drop-shadow-lg" />
        <h1
          className="text-4xl font-extrabold mb-1 text-center tracking-wide text-white"
          style={{ textShadow: "0 2px 0 rgba(0,0,0,0.6), 0 0 18px rgba(0,0,0,0.5)" }}
        >
          Tiny Swords RTS
        </h1>
        <p className="text-white/80 mb-6 text-center text-sm drop-shadow">
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
              <BigButton color="blue" onClick={() => router.push("/ffa")}>
                ⚔️ Đấu 1 chọi nhiều (chọn phe, vs 4 AI)
              </BigButton>
              <BigButton color="red" onClick={() => router.push("/community-map")}>
                🧪 Map cộng đồng (thử nghiệm)
              </BigButton>
              <BigButton color="red" onClick={() => setStep("endless-map")}>
                🌊 Endless Mode (sóng vô tận)
              </BigButton>
            </div>
          )}

          {step === "bot-map" && <MapPicker onBack={() => setStep("mode")} onPick={startBot} />}
          {step === "endless-map" && <MapPicker onBack={() => setStep("mode")} onPick={startEndless} />}

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
        <p className="text-white/50 text-xs mt-6 max-w-md text-center drop-shadow">
          Chơi với Bot để luyện tập một mình, hoặc tạo phòng rồi gửi mã cho bạn bè để đấu real-time. Endless Mode để thử
          sức sống sót qua càng nhiều sóng địch càng tốt.
        </p>
      )}
      </div>
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
  const [t, setT] = useState(50);
  const size = sliderToMapSize(t);
  const p = MAP_PRESETS[size];
  return (
    <div className="space-y-4">
      <p className="text-[#3a2c1a]/70 text-sm text-center flex items-center justify-center gap-1">
        <img src="/assets/ui9/icon-hammer.png" className="icon-inline" alt="" />
        Chọn kích thước bản đồ
      </p>

      <div className="flex justify-center">
        <MapPreviewSvg size={size} />
      </div>

      <div className="text-center">
        <div className="font-bold text-[#3a2c1a]">
          {p.label} <span className="text-[#3a2c1a]/40 text-xs font-normal">({p.worldW}×{p.worldH})</span>
        </div>
        <div className="text-[#3a2c1a]/55 text-xs">{p.desc}</div>
      </div>

      <div className="px-1">
        <input
          type="range"
          min={0}
          max={100}
          step={50}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="w-full accent-[#3a2c1a] cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-[#3a2c1a]/50 px-0.5 -mt-1">
          <span>Nhỏ</span>
          <span>Vừa</span>
          <span>Lớn</span>
        </div>
      </div>

      <button onClick={() => onPick(size)} className="w-full h-14 block">
        <NineSlice prefix="btn-blue" className="w-full h-full">
          <span className="font-bold text-white">Bắt đầu</span>
        </NineSlice>
      </button>
      <button onClick={onBack} className="text-[#3a2c1a]/50 text-sm hover:text-[#3a2c1a] block mx-auto">
        ← Quay lại
      </button>
    </div>
  );
}

/** Xem trước bố cục bản đồ thật (vị trí căn cứ + mỏ tài nguyên) trước khi vào trận */
function MapPreviewSvg({ size }: { size: MapSize }) {
  const p = MAP_PRESETS[size];
  const W = 160;
  const H = Math.round((p.worldH / p.worldW) * W);
  const sx = W / p.worldW;
  const sy = H / p.worldH;
  const leftX = p.baseMargin * sx;
  const rightX = (p.worldW - p.baseMargin) * sx;
  const midY = (p.worldH / 2) * sy;
  const forestH = Math.max(4, 18 * sy * (p.treeSpacing < 70 ? 0.8 : 1));
  const riverX = p.riverX * sx;
  const riverW = Math.max(3, p.riverWidth * sx);

  const resDot = (baseX: number, dir: 1 | -1, color: string, key: string) => {
    const spec = RESOURCE_NODE_LAYOUT.find((r) => r.kind === key)!;
    const x = baseX + dir * spec.offsetX * sx;
    const y = midY + spec.offsetY * sy;
    return <circle key={key} cx={x} cy={y} r={2} fill={color} />;
  };

  return (
    <svg width={W} height={H} className="rounded shrink-0 border border-black/20" style={{ background: "#4a7a4a" }}>
      <rect x={0} y={0} width={W} height={forestH} fill="#2f5a2f" />
      <rect x={0} y={H - forestH} width={W} height={forestH} fill="#2f5a2f" />
      <rect x={riverX - riverW / 2} y={0} width={riverW} height={H} fill="#2b8a8a" opacity={0.85} />
      {p.bridgeYs.map((by, i) => (
        <rect key={i} x={riverX - riverW / 2 - 2} y={by * sy - 5} width={riverW + 4} height={10} fill="#8a5a34" />
      ))}
      {p.hillSpecs.map((h, i) => (
        <circle key={`h${i}`} cx={h.x * sx} cy={h.y * sy} r={7 * h.scale} fill="#7fa9a3" opacity={0.8} />
      ))}
      {p.forestClusters.map((f, i) => (
        <circle key={`f${i}`} cx={f.x * sx} cy={f.y * sy} r={5 * f.scale + 2} fill="#1e4620" opacity={0.85} />
      ))}
      {p.neutralResource && (
        <circle
          cx={p.neutralResource.x * sx}
          cy={p.neutralResource.y * sy}
          r={3.2}
          fill="#facc15"
          stroke="#7a5c00"
          strokeWidth={0.6}
        />
      )}
      <rect x={leftX - 3} y={midY - 3} width={6} height={6} fill="#3b82f6" stroke="#1e293b" strokeWidth={0.5} />
      <rect x={rightX - 3} y={midY - 3} width={6} height={6} fill="#ef4444" stroke="#1e293b" strokeWidth={0.5} />
      {resDot(leftX, 1, "#a3752c", "wood")}
      {resDot(leftX, 1, "#facc15", "gold")}
      {resDot(leftX, 1, "#f472b6", "meat")}
      {resDot(rightX, -1, "#a3752c", "wood")}
      {resDot(rightX, -1, "#facc15", "gold")}
      {resDot(rightX, -1, "#f472b6", "meat")}
    </svg>
  );
}
