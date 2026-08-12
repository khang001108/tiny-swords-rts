"use client";

import { useEffect, useRef } from "react";
import { createTiledGame } from "@/game/TiledGame";

export default function CommunityMapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = createTiledGame(containerRef.current);
    return () => game.destroy(true);
  }, []);

  return <div ref={containerRef} className="flex-1 w-full" />;
}
