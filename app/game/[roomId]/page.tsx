"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { mapSizeFromRoomCode } from "@/game/net";
import { MapSize } from "@/game/entities";

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
  const mode = (searchParams.get("mode") === "bot" ? "bot" : "online") as "bot" | "online";
  const mapParam = searchParams.get("map") as MapSize | null;
  const mapSize: MapSize = mode === "bot" ? mapParam ?? "medium" : mapSizeFromRoomCode(params.roomId);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-6 px-2">
      <GameCanvas roomCode={params.roomId.toUpperCase()} isHost={isHost} mode={mode} mapSize={mapSize} />
    </main>
  );
}
