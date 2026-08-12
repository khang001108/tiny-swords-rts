"use client";

import { CSSProperties, ReactNode } from "react";

// ct/cb/cl/cr = kích thước (px) của viền trên/dưới/trái/phải trong khung 9-slice hiển thị
// (không nhất thiết bằng kích thước gốc của ảnh — ảnh được co giãn vừa khít ô nhờ
// backgroundSize: 100% 100%). "banner" dùng số đo lệch trái/phải, trên/dưới vì ảnh gốc
// (cuộn giấy da) vốn không đối xứng — paper/btn-* vẫn vuông vắn nên ct=cb, cl=cr.
const SIZES: Record<string, { ct: number; cb: number; cl: number; cr: number }> = {
  paper: { ct: 22, cb: 22, cl: 26, cr: 26 },
  "btn-blue": { ct: 24, cb: 24, cl: 22, cr: 22 },
  "btn-red": { ct: 24, cb: 24, cl: 22, cr: 22 },
  banner: { ct: 22, cb: 36, cl: 34, cr: 28 },
};

/**
 * Bọc nội dung trong khung 9-slice (góc giữ nguyên tỉ lệ, viền/tâm giãn theo kích thước
 * thật) dựng từ các mảnh đã cắt sẵn trong /public/assets/ui9. Dùng cho panel giấy da,
 * banner cuộn giấy và nút bấm lớn theo phong cách Tiny Swords.
 */
export default function NineSlice({
  prefix,
  className,
  style,
  children,
}: {
  prefix: "paper" | "btn-blue" | "btn-red" | "banner";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const { ct, cb, cl, cr } = SIZES[prefix];
  const base = `/assets/ui9/${prefix}`;
  // Mỗi ô nền được gán row/column TƯỜNG MINH (không để trình duyệt tự auto-place) — nếu để
  // auto-place trộn với ô nội dung bên dưới (span 1/4 tường minh), một số bản Chromium tính
  // sai grid-template-rows (tự sinh thêm hàng ẩn cao 0px) khiến 9-slice render trong suốt.
  const cellStyle = (file: string, row: number, col: number): CSSProperties => ({
    gridRow: row,
    gridColumn: col,
    backgroundImage: `url(${base}-${file}.png)`,
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
  });

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `${cl}px 1fr ${cr}px`,
        gridTemplateRows: `${ct}px 1fr ${cb}px`,
        ...style,
      }}
    >
      <div style={cellStyle("tl", 1, 1)} />
      <div style={cellStyle("t", 1, 2)} />
      <div style={cellStyle("tr", 1, 3)} />
      <div style={cellStyle("l", 2, 1)} />
      <div style={cellStyle("c", 2, 2)} />
      <div style={cellStyle("r", 2, 3)} />
      <div style={cellStyle("bl", 3, 1)} />
      <div style={cellStyle("b", 3, 2)} />
      <div style={cellStyle("br", 3, 3)} />
      <div
        style={{
          gridColumn: "1 / 4",
          gridRow: "1 / 4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
