"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { mapIdFromRoomCode } from "@/game/net";
import { MapId } from "@/game/entities";

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[640px] flex items-center justify-center text-white/50">
      Đang tải trận đấu...
    </div>
  ),
});

export default function GameRoomPage({ params }: { params: { roomId: string } }) {
  const searchParams = useSearchParams();
  const isHost = searchParams.get("host") === "1";
  const modeParam = searchParams.get("mode");
  const mode = (modeParam === "bot" || modeParam === "endless" ? modeParam : "online") as "bot" | "online" | "endless";
  const mapParam = searchParams.get("map") as MapId | null;
  const mapId: MapId = mode === "online" ? mapIdFromRoomCode(params.roomId) : mapParam ?? "classic";

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-[#0e1a0e]"
      style={{
        paddingTop: "max(6px, env(safe-area-inset-top))",
        paddingBottom: "max(6px, env(safe-area-inset-bottom))",
        paddingLeft: "max(4px, env(safe-area-inset-left))",
        paddingRight: "max(4px, env(safe-area-inset-right))",
      }}
    >
      <GameCanvas roomCode={params.roomId.toUpperCase()} isHost={isHost} mode={mode} mapId={mapId} />
    </main>
  );
}
