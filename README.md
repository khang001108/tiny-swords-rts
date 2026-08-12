# Tiny Swords RTS — đấu Bot hoặc đấu online 1vs1

Game RTS: xây kinh tế (vàng tự sinh), có 4 loại bản đồ với lối chơi khác nhau (Cổ Điển /
Hẻm Núi / Đồng Bằng Rộng / Pháo Đài) với
cụm công trình quanh căn cứ (Tháp canh tự động bắn địch trong tầm, Doanh trại, Nhà
dân, Tu viện — công trình càng nhiều thì giới hạn quân số càng cao), chiêu mộ 3 loại
quân (Lính thường / Chiến binh / Cung thủ) với animation đi/đánh thật. Chơi được:
- **Vs Bot**: đấu với AI ngay lập tức, không cần cấu hình gì (không cần Supabase).
- **Vs Người**: 2 người thấy nhau di chuyển/đánh nhau **real-time** qua Supabase
  Realtime (broadcast + presence) — không cần server riêng, không cần bảng database.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Phaser 3 (canvas game engine) — sprite animation thật (idle/walk/attack) từ spritesheet
- Supabase Realtime (chỉ dùng cho chế độ Vs Người — kênh broadcast, không cần schema DB)
- Deploy: Vercel

## Asset
Sprite lấy từ bộ **Tiny Swords** (Pixel Frog) bạn đã upload (cả bản đầy đủ và Free Pack
cập nhật mới hơn) — đã copy sẵn phần cần dùng vào `public/assets/`:
- `units/` — Pawn/Warrior/Archer (xanh + đỏ), spritesheet 192×192/frame
- `buildings/` — Castle, Tower, Barracks, House1, Monastery (xanh + đỏ)
- `terrain/` — nhiều texture cỏ dùng luân phiên cho các loại bản đồ, cây, bụi/đá/nấm trang trí
- `ui9/` — icon, nút bấm, khung giấy đã cắt sẵn theo kiểu 9-slice từ UI/UI Elements của 2 gói

## Chạy thử ở máy local

```bash
npm install
cp .env.local.example .env.local   # chỉ cần điền nếu muốn thử chế độ Vs Người
npm run dev
```

Mở `http://localhost:3000` → chọn **"Chơi với Bot"** để thử ngay, không cần cấu hình
gì thêm. Muốn thử Vs Người thì mở 2 tab, một tab **"Tạo phòng mới"**, tab còn lại nhập
đúng mã phòng — loại bản đồ được mã hoá sẵn trong ký tự đầu của mã phòng (xem
`MAP_ID_PREFIX` trong `game/net.ts`) nên cả 2 bên luôn đồng bộ đúng 1 bản đồ.

## 1. Tạo project Supabase (chỉ cần cho chế độ Vs Người, ~2 phút)
1. Vào https://supabase.com → **New project**.
2. Vào **Project Settings → API**, copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy khóa `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Không cần tạo bảng nào — game chỉ dùng kênh broadcast/presence thuần.

## 2. Đẩy code lên GitHub
```bash
git init
git add .
git commit -m "Tiny Swords RTS - vs Bot + vs Người + chọn map"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## 3. Deploy lên Vercel
1. Vào https://vercel.com → **Add New Project** → chọn repo vừa push.
2. Thêm 2 biến môi trường (bỏ qua nếu chỉ dùng chế độ Vs Bot):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Bấm **Deploy**.

## Cách chơi
- Vàng tự sinh theo thời gian (4/giây).
- Bấm nút chiêu mộ quân — quân tự đi về phía căn cứ địch, tự đánh quân địch/căn cứ
  trong tầm. Số quân tối đa cùng lúc = 6 + 2 mỗi công trình quanh căn cứ (bản đồ Pháo Đài
  có đủ 4 công trình → tối đa 14 quân).
- Tháp canh tự động bắn quân địch đi ngang qua trong tầm 150px, không cần điều khiển.
- Căn cứ về 0 máu → thua.

## Kiến trúc đồng bộ & AI
- **Vs Người**: mỗi client tự chịu trách nhiệm (authoritative) cho quân & máu căn cứ
  *của chính mình*, gửi `hit` cho đối thủ khi gây sát thương — không bao giờ 2 client
  tranh nhau sửa cùng 1 giá trị, chạy tốt trên serverless của Vercel.
- **Vs Bot**: `game/opponent.ts` (`BotOpponent`) mô phỏng y hệt giao diện của kết nối
  mạng (`onState`/`onHit`/`onGameOver`) nên `MainScene` dùng chung 1 luồng logic cho cả
  2 chế độ — không cần if/else rải rác trong code chiến đấu.

Muốn thêm loại quân/công trình, sửa `game/entities.ts` (`UNIT_CONFIGS`,
`BUILDING_VISUALS`). Muốn thêm loại bản đồ mới, thêm 1 file `game/maps/map-xxx.ts`
theo khuôn `MapPreset` rồi đăng ký vào `game/maps/index.ts` + `MAP_ID_ORDER` (trong
`game/entities.ts`) + `MAP_ID_PREFIX`/`PREFIX_TO_MAP_ID` (trong `game/net.ts`) — không
cần sửa gì trong `MainScene.ts`/`villager.ts`/`opponent.ts`/`pathfinding.ts`. Muốn chỉnh
độ khó bot, sửa tham số `difficulty` khi khởi tạo `BotOpponent` trong
`MainScene.connectRoom()`.

