"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import { createTiledGame } from "@/game/TiledGame";
import { gameEvents } from "@/game/events";

interface MinimapPoint {
  x: number;
  y: number;
}
interface MinimapData {
  worldW: number;
  worldH: number;
  player: MinimapPoint | null;
  bases: MinimapPoint[];
  camera: { x: number; y: number; w: number; h: number };
}

export default function CommunityMapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [minimap, setMinimap] = useState<MinimapData | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = createTiledGame(containerRef.current);

    const onMinimap = (p: MinimapData) => setMinimap(p);
    gameEvents.on("community-minimap-data", onMinimap);

    return () => {
      gameEvents.off("community-minimap-data", onMinimap);
      game.destroy(true);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1 w-full touch-none">
      {minimap && (
        <div
          className="absolute left-0 bottom-0 z-20"
          style={{
            paddingLeft: "max(10px, env(safe-area-inset-left))",
            paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          }}
        >
          <MinimapPanel data={minimap} />
        </div>
      )}
      <div className="absolute top-0 right-0 z-20 text-white/60 text-[10px] px-2 py-1 pointer-events-none">
        Chụm/xoè 2 ngón để zoom
      </div>
    </div>
  );
}

function MinimapPanel({ data }: { data: MinimapData }) {
  const W = 130;
  const H = 90;
  const sx = (W - 8) / data.worldW;
  const sy = (H - 8) / data.worldH;
  const toX = (x: number) => 4 + x * sx;
  const toY = (y: number) => 4 + y * sy;

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const worldX = (px - 4) / sx;
    const worldY = (py - 4) / sy;
    gameEvents.emit("community-minimap-jump", { x: worldX, y: worldY });
  };

  return (
    <div
      onClick={handleClick}
      className="relative rounded-md bg-[#1a2e1a]/85 border border-[#e9dcbb]/70 shadow-lg cursor-pointer overflow-hidden"
      style={{ width: W, height: H }}
    >
      <svg width={W} height={H} className="absolute inset-0">
        {data.bases.map((b, i) => (
          <rect
            key={i}
            x={toX(b.x) - 3}
            y={toY(b.y) - 3}
            width={6}
            height={6}
            fill={i === 0 ? "#3b82f6" : "#171717"}
            stroke="#fff"
            strokeWidth={0.5}
          />
        ))}
        {data.player && <circle cx={toX(data.player.x)} cy={toY(data.player.y)} r={2.4} fill="#60a5fa" />}
        <rect
          x={toX(data.camera.x)}
          y={toY(data.camera.y)}
          width={data.camera.w * sx}
          height={data.camera.h * sy}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.3}
          opacity={0.9}
        />
      </svg>
    </div>
  );
}
