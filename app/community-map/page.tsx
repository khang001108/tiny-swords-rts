"use client";

import dynamic from "next/dynamic";

const CommunityMapCanvas = dynamic(() => import("@/components/CommunityMapCanvas"), {
  ssr: false,
  loading: () => <div className="flex-1 w-full flex items-center justify-center text-white/50">Đang tải map...</div>,
});

export default function CommunityMapPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#1a3a3a]">
      <div className="px-3 py-2 bg-black/40 text-white text-xs flex items-center justify-between">
        <span>🧪 Map cộng đồng (thử nghiệm) — dữ liệu thật từ Tiled, chưa có gameplay đầy đủ</span>
        <a href="/" className="underline">
          ← Về sảnh chờ
        </a>
      </div>
      <CommunityMapCanvas />
    </main>
  );
}
