"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { randomRoomCode } from "@/game/net";

export default function LobbyPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  const createRoom = () => {
    const code = randomRoomCode();
    router.push(`/game/${code}?host=1`);
  };

  const joinRoom = () => {
    if (joinCode.trim().length < 4) return;
    router.push(`/game/${joinCode.trim().toUpperCase()}?host=0`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-extrabold mb-1 text-center">⚔️ Tiny Swords RTS</h1>
      <p className="text-white/60 mb-10 text-center">Xây căn cứ, chiêu mộ quân, đấu online 1vs1 real-time</p>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={createRoom}
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
            maxLength={5}
            className="flex-1 px-3 py-3 rounded-lg bg-white/10 border border-white/20 outline-none uppercase tracking-widest text-center font-mono"
          />
          <button
            onClick={joinRoom}
            className="px-5 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 font-semibold"
          >
            Vào
          </button>
        </div>
      </div>

      <p className="text-white/30 text-xs mt-10 max-w-md text-center">
        Tạo phòng rồi gửi mã cho bạn bè để họ vào cùng. Cả hai cần mở trang này cùng lúc để trận đấu bắt đầu.
      </p>
    </main>
  );
}
