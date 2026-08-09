# Tiny Swords RTS — đấu online 1vs1

Game RTS nhẹ: xây kinh tế (vàng tự sinh theo thời gian), chiêu mộ quân (Lính thường /
Chiến binh / Cung thủ), quân tự động tiến về phía căn cứ đối thủ và giao chiến.
2 người chơi thấy nhau di chuyển/đánh nhau **real-time** qua Supabase Realtime
(broadcast + presence) — không cần server riêng, không cần bảng database nào.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Phaser 3 (canvas game engine)
- Supabase Realtime (kênh broadcast — miễn phí, không cần schema DB)
- Deploy: Vercel

## Asset
Sprite lấy từ bộ **Tiny Swords** (Pixel Frog) bạn đã upload — đã copy sẵn phần cần dùng
vào `public/assets/`. Nếu muốn đổi unit/hình khác, copy thêm file từ 2 file zip gốc vào
`public/assets/units|castle|terrain|ui` rồi trỏ đường dẫn trong
`game/scenes/MainScene.ts` (hàm `preload()`).

## Chạy thử ở máy local

```bash
npm install
cp .env.local.example .env.local   # rồi điền URL + anon key Supabase (xem bên dưới)
npm run dev
```

Mở 2 tab (hoặc 2 trình duyệt khác nhau) tới `http://localhost:3000`, một tab bấm
**"Tạo phòng mới"**, tab còn lại nhập đúng mã phòng rồi bấm **"Vào"** — trận đấu tự bắt
đầu khi đủ 2 người.

## 1. Tạo project Supabase (miễn phí, ~2 phút)
1. Vào https://supabase.com → **New project**.
2. Sau khi tạo xong, vào **Project Settings → API**.
3. Copy `Project URL` → dán vào `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy khóa `anon public` → dán vào `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Vào **Database → Replication** (hoặc **Project Settings → Realtime**) đảm bảo
   Realtime đang bật cho project (mặc định đã bật sẵn, không cần tạo bảng nào vì
   game này chỉ dùng kênh broadcast/presence thuần, không đọc/ghi Postgres).

## 2. Đẩy code lên GitHub
```bash
git init
git add .
git commit -m "Tiny Swords RTS - online 1vs1"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## 3. Deploy lên Vercel
1. Vào https://vercel.com → **Add New Project** → chọn repo vừa push.
2. Ở bước **Environment Variables**, thêm đúng 2 biến:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Bấm **Deploy**. Xong là có link chơi online, gửi cho bạn bè là đấu được.

## Cách chơi
- Vàng tự sinh theo thời gian (4/giây).
- Bấm nút chiêu mộ quân — quân tự đi về phía căn cứ địch, tự đánh quân địch hoặc
  căn cứ địch trong tầm.
- Căn cứ về 0 máu → thua. Có UI thông báo thắng/thua ngay khi kết thúc.

## Kiến trúc đồng bộ (quan trọng nếu bạn muốn mở rộng)
Mỗi client **tự chịu trách nhiệm (authoritative)** cho quân và máu căn cứ **của chính
mình**:
- Client A mô phỏng quân của A cục bộ, phát (`broadcast`) vị trí/HP quân của A ~7-8
  lần/giây cho đối thủ.
- Khi quân của A vào tầm đánh quân/căn cứ của B, A gửi sự kiện `hit` (kèm sát thương)
  cho B — B mới là người thực sự trừ máu quân/căn cứ của B và báo lại HP mới ở lần
  broadcast tiếp theo.
- Nhờ vậy không bao giờ có 2 client tranh nhau quyền sửa cùng 1 giá trị HP → không cần
  server trung tâm, dùng thẳng Supabase Realtime là đủ, chạy tốt trên hạ tầng
  serverless của Vercel.

Muốn thêm loại quân, sửa `game/entities.ts`. Muốn đổi bố cục bản đồ/cách quân di
chuyển (ví dụ thêm nhiều làn, pathfinding vòng vật cản...), sửa
`game/scenes/MainScene.ts`.
