"use client";

import { useRouter } from "next/navigation";
import { useState, CSSProperties } from "react";
import { randomRoomCode } from "@/game/net";
import { MAP_PRESETS, MapId, MAP_ID_ORDER, RESOURCE_NODE_LAYOUT } from "@/game/entities";
import NineSlice from "@/components/NineSlice";

type Step = "mode" | "bot-map" | "online-choice" | "online-map" | "endless-map";

export default function LobbyPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mode");
  const [joinCode, setJoinCode] = useState("");

  const startBot = (map: MapId) => {
    const id = Math.random().toString(36).slice(2, 8);
    router.push(`/game/bot-${id}?mode=bot&map=${map}`);
  };

  const startEndless = (map: MapId) => {
    const id = Math.random().toString(36).slice(2, 8);
    router.push(`/game/endless-${id}?mode=endless&map=${map}`);
  };

  const createOnlineRoom = (map: MapId) => {
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
        <img src="/assets/buildings/Castle_Blue.png" alt="" className="w-16 h-16 object-contain drop-shadow-lg relative z-10 -mb-3" />
        <NineSlice prefix="banner" className="w-full max-w-[280px]" style={{ minHeight: 96 }}>
          <div className="px-5 py-2 text-center">
            <h1 className="text-2xl font-extrabold tracking-wide text-[#3a2c1a]">Tiny Swords RTS</h1>
            <p className="text-[#3a2c1a]/70 text-[11px] mt-0.5">
              Xây căn cứ, chiêu mộ quân, đấu với Bot hoặc bạn bè real-time
            </p>
          </div>
        </NineSlice>

      <NineSlice prefix="paper" className="w-full max-w-sm mt-4" style={{ minHeight: 0 }}>
        <div className="w-full px-6 py-7 text-[#3a2c1a]">
          {step === "mode" && (
            <div className="space-y-4">
              <BigButton color="blue" onClick={() => setStep("bot-map")}>
                Chơi với Bot
              </BigButton>
              <BigButton color="red" onClick={() => setStep("online-choice")}>
                Chơi với người
              </BigButton>
              <BigButton color="blue" onClick={() => router.push("/ffa")}>
                Đấu 1 chọi nhiều (chọn phe, vs 4 AI)
              </BigButton>
              <BigButton color="red" onClick={() => router.push("/community-map")}>
                Map cộng đồng (thử nghiệm)
              </BigButton>
              <BigButton color="red" onClick={() => setStep("endless-map")}>
                Endless Mode (sóng vô tận)
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
                <button onClick={joinRoom} className="w-20 h-[50px] shrink-0 active:scale-[0.98] transition-transform">
                  <NineSlice prefix="btn-blue" className="w-full h-full">
                    <span className="font-bold text-white text-sm drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">Vào</span>
                  </NineSlice>
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
        <span className="flex items-center justify-center gap-2 px-2">
          <RibbonTag color={color} />
          <span className="font-bold text-white text-[15px] leading-tight drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
            {children}
          </span>
        </span>
      </NineSlice>
    </button>
  );
}

/** Lá cờ/ribbon nhỏ (cắt từ UI Elements/Ribbons — Free Pack) đứng trước text nút, thay cho icon emoji tự chế */
function RibbonTag({ color }: { color: "blue" | "red" }) {
  const cellStyle = (part: "l" | "m" | "r"): CSSProperties => ({
    backgroundImage: `url(/assets/ui9/ribbon-${color}-${part}.png)`,
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
  });
  return (
    <span
      className="shrink-0"
      style={{ display: "grid", gridTemplateColumns: "9px 12px 9px", width: 30, height: 20 }}
    >
      <span style={cellStyle("l")} />
      <span style={cellStyle("m")} />
      <span style={cellStyle("r")} />
    </span>
  );
}

/** Icon đại diện cho từng loại map — lấy từ bộ UI đã cắt sẵn (public/assets/ui9), nguồn gốc
    từ gói Tiny Swords / Tiny Swords (Free Pack). */
const MAP_ICON: Record<MapId, string> = {
  classic: "swords",
  canyon: "shield",
  plains: "gold",
  stronghold: "hammer",
};

function MapPicker({ onBack, onPick }: { onBack: () => void; onPick: (m: MapId) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[#3a2c1a]/70 text-sm text-center flex items-center justify-center gap-1">
        <img src="/assets/ui9/icon-hammer.png" className="icon-inline" alt="" />
        Chọn loại bản đồ
      </p>

      <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-0.5 -mr-0.5">
        {MAP_ID_ORDER.map((id) => (
          <MapCard key={id} mapId={id} onPick={onPick} />
        ))}
      </div>

      <button onClick={onBack} className="text-[#3a2c1a]/50 text-sm hover:text-[#3a2c1a] block mx-auto">
        ← Quay lại
      </button>
    </div>
  );
}

/** 1 dòng bản đồ trong danh sách chọn — bấm trực tiếp vào để bắt đầu, không cần bước xác nhận riêng */
function MapCard({ mapId, onPick }: { mapId: MapId; onPick: (m: MapId) => void }) {
  const p = MAP_PRESETS[mapId];
  return (
    <button
      onClick={() => onPick(mapId)}
      className="w-full flex items-center gap-3 rounded-lg bg-black/5 hover:bg-black/10 active:scale-[0.98] transition border border-[#3a2c1a]/15 px-2.5 py-2.5 text-left"
    >
      <MapPreviewSvg mapId={mapId} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <img src={`/assets/ui9/icon-${MAP_ICON[mapId]}.png`} className="icon-inline" alt="" />
          <span className="font-bold text-[#3a2c1a] text-sm">{p.label}</span>
        </div>
        <p className="text-[#3a2c1a]/55 text-[11px] leading-snug mt-0.5">{p.desc}</p>
      </div>
    </button>
  );
}

const NEUTRAL_RES_COLOR: Record<string, string> = { gold: "#facc15", wood: "#a3752c", meat: "#f472b6" };

/** Xem trước bố cục bản đồ thật (căn cứ, vùng nước, đồi/rừng, mỏ tài nguyên) — dùng làm thumbnail
 * trong danh sách chọn map. Đọc thẳng toạ độ thật trong MapPreset — 2 base không còn đối xứng
 * nên không có phép "vẽ 1 bên rồi lật sang bên kia" như trước. */
function MapPreviewSvg({ mapId }: { mapId: MapId }) {
  const p = MAP_PRESETS[mapId];
  const W = 88;
  const H = Math.round((p.worldH / p.worldW) * W);
  const sx = W / p.worldW;
  const sy = H / p.worldH;

  const resDot = (base: { x: number; y: number; facingDir: 1 | -1 }, color: string, kind: "wood" | "gold" | "meat") => {
    const spec = RESOURCE_NODE_LAYOUT.find((r) => r.kind === kind)!;
    const x = (base.x + base.facingDir * spec.offsetX) * sx;
    const y = (base.y + spec.offsetY) * sy;
    return <circle key={`${base === p.baseLeft ? "l" : "r"}-${kind}`} cx={x} cy={y} r={1.4} fill={color} />;
  };

  return (
    <svg width={W} height={H} className="rounded shrink-0 border border-black/20" style={{ background: "#4a7a4a" }}>
      {p.waterBodies.map((band, bi) => {
        const x = band.xMin * sx;
        const y = band.yMin * sy;
        const w = (band.xMax - band.xMin) * sx;
        const h = (band.yMax - band.yMin) * sy;
        return (
          <g key={`w${bi}`}>
            <rect x={x} y={y} width={w} height={h} fill="#2b8a8a" opacity={0.85} />
            {band.bridgeAt.map((at, i) =>
              band.orientation === "vertical" ? (
                <rect key={i} x={x - 1} y={at * sy - 2.5} width={w + 2} height={5} fill="#8a5a34" />
              ) : (
                <rect key={i} x={at * sx - 2.5} y={y - 1} width={5} height={h + 2} fill="#8a5a34" />
              )
            )}
          </g>
        );
      })}
      {p.hillSpecs.map((h, i) => (
        <circle key={`h${i}`} cx={h.x * sx} cy={h.y * sy} r={7 * h.scale} fill="#7fa9a3" opacity={0.8} />
      ))}
      {p.forestClusters.map((f, i) => (
        <circle key={`f${i}`} cx={f.x * sx} cy={f.y * sy} r={5 * f.scale + 2} fill="#1e4620" opacity={0.85} />
      ))}
      {p.neutralResources.map((n, i) => (
        <circle
          key={`n${i}`}
          cx={n.x * sx}
          cy={n.y * sy}
          r={2.2}
          fill={NEUTRAL_RES_COLOR[n.kind]}
          stroke="#7a5c00"
          strokeWidth={0.5}
        />
      ))}
      <rect
        x={p.baseLeft.x * sx - 2.2}
        y={p.baseLeft.y * sy - 2.2}
        width={4.4}
        height={4.4}
        fill="#3b82f6"
        stroke="#1e293b"
        strokeWidth={0.4}
      />
      <rect
        x={p.baseRight.x * sx - 2.2}
        y={p.baseRight.y * sy - 2.2}
        width={4.4}
        height={4.4}
        fill="#ef4444"
        stroke="#1e293b"
        strokeWidth={0.4}
      />
      {resDot(p.baseLeft, "#a3752c", "wood")}
      {resDot(p.baseLeft, "#facc15", "gold")}
      {resDot(p.baseLeft, "#f472b6", "meat")}
      {resDot(p.baseRight, "#a3752c", "wood")}
      {resDot(p.baseRight, "#facc15", "gold")}
      {resDot(p.baseRight, "#f472b6", "meat")}
    </svg>
  );
}
