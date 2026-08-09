"use client";

import { CSSProperties, ReactNode } from "react";

const SIZES: Record<string, { cw: number; ch: number }> = {
  paper: { cw: 26, ch: 22 },
  "btn-blue": { cw: 22, ch: 24 },
  "btn-red": { cw: 22, ch: 24 },
};

/**
 * Bọc nội dung trong khung 9-slice (góc giữ nguyên tỉ lệ, viền/tâm giãn theo kích thước
 * thật) dựng từ các mảnh đã cắt sẵn trong /public/assets/ui9. Dùng cho panel giấy da và
 * nút bấm lớn theo phong cách Tiny Swords.
 */
export default function NineSlice({
  prefix,
  className,
  style,
  children,
}: {
  prefix: "paper" | "btn-blue" | "btn-red";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const { cw, ch } = SIZES[prefix];
  const base = `/assets/ui9/${prefix}`;
  const cellStyle = (file: string): CSSProperties => ({
    backgroundImage: `url(${base}-${file}.png)`,
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
  });

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `${cw}px 1fr ${cw}px`,
        gridTemplateRows: `${ch}px 1fr ${ch}px`,
        ...style,
      }}
    >
      <div style={cellStyle("tl")} />
      <div style={cellStyle("t")} />
      <div style={cellStyle("tr")} />
      <div style={cellStyle("l")} />
      <div style={cellStyle("c")} />
      <div style={cellStyle("r")} />
      <div style={cellStyle("bl")} />
      <div style={cellStyle("b")} />
      <div style={cellStyle("br")} />
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
