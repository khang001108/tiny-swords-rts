import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tiny Swords RTS — Đấu online 1vs1",
  description: "Game RTS xây căn cứ, chiến đấu real-time với bạn bè, dùng asset Tiny Swords",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-gradient-to-b from-[#1b2e1b] to-[#0e1a0e] text-white">
        {children}
      </body>
    </html>
  );
}
