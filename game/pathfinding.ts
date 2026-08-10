export interface NavGrid {
  cols: number;
  rows: number;
  cellSize: number;
  blocked: Uint8Array; // 1 = ô này không đi qua được
  worldW: number;
  worldH: number;
}

export interface CircleObstacle {
  x: number;
  y: number;
  r: number;
}

export interface RiverSpec {
  xMin: number;
  xMax: number;
  bridgeYs: number[];
  bridgeHalfHeight: number;
}

/** Dựng lưới ô vuông đánh dấu ô nào đi được — gọi 1 lần khi vào trận, dùng lại cho mọi lần tìm đường. */
export function buildNavGrid(
  worldW: number,
  worldH: number,
  cellSize: number,
  obstacles: CircleObstacle[],
  river: RiverSpec | null
): NavGrid {
  const cols = Math.ceil(worldW / cellSize);
  const rows = Math.ceil(worldH / cellSize);
  const blocked = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;
      let isBlocked = false;

      if (river && cx > river.xMin - 6 && cx < river.xMax + 6) {
        const nearBridge = river.bridgeYs.some((by) => Math.abs(cy - by) <= river.bridgeHalfHeight / 2 + cellSize / 2);
        if (!nearBridge) isBlocked = true;
      }
      if (!isBlocked) {
        for (const o of obstacles) {
          const dx = cx - o.x;
          const dy = cy - o.y;
          if (dx * dx + dy * dy < o.r * o.r) {
            isBlocked = true;
            break;
          }
        }
      }
      blocked[r * cols + c] = isBlocked ? 1 : 0;
    }
  }
  return { cols, rows, cellSize, blocked, worldW, worldH };
}

function cellIndex(grid: NavGrid, c: number, r: number) {
  return r * grid.cols + c;
}

function isBlockedCell(grid: NavGrid, c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return true;
  return grid.blocked[cellIndex(grid, c, r)] === 1;
}

function toCell(grid: NavGrid, x: number, y: number) {
  return {
    c: Math.max(0, Math.min(grid.cols - 1, Math.floor(x / grid.cellSize))),
    r: Math.max(0, Math.min(grid.rows - 1, Math.floor(y / grid.cellSize))),
  };
}

/** Nếu ô đích/xuất phát rơi đúng vào vùng chặn (hiếm), lan ra tìm ô trống gần nhất */
function findNearestOpenCell(grid: NavGrid, c: number, r: number): { c: number; r: number } | null {
  if (!isBlockedCell(grid, c, r)) return { c, r };
  for (let radius = 1; radius <= 6; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (!isBlockedCell(grid, nc, nr)) return { c: nc, r: nr };
      }
    }
  }
  return null;
}

const MAX_A_STAR_NODES = 2500; // chặn an toàn — bản đồ của game này nhỏ nên gần như không bao giờ chạm ngưỡng

/**
 * A* 8 hướng đơn giản (không cần thư viện priority-queue ngoài — lưới của game này đủ nhỏ
 * để quét tuyến tính tìm nút có f nhỏ nhất mỗi bước mà vẫn đủ nhanh).
 * Trả về danh sách waypoint theo toạ độ world (đã rút gọn các đoạn thẳng hàng cho mượt).
 */
export function findPath(grid: NavGrid, startX: number, startY: number, endX: number, endY: number): { x: number; y: number }[] {
  const startCellRaw = toCell(grid, startX, startY);
  const endCellRaw = toCell(grid, endX, endY);
  const start = findNearestOpenCell(grid, startCellRaw.c, startCellRaw.r) ?? startCellRaw;
  const end = findNearestOpenCell(grid, endCellRaw.c, endCellRaw.r) ?? endCellRaw;

  const startIdx = cellIndex(grid, start.c, start.r);
  const endIdx = cellIndex(grid, end.c, end.r);
  if (startIdx === endIdx) return [{ x: endX, y: endY }];

  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const open = new Set<number>();
  const closed = new Set<number>();

  const h = (c: number, r: number) => Math.hypot(end.c - c, end.r - r);

  gScore.set(startIdx, 0);
  fScore.set(startIdx, h(start.c, start.r));
  open.add(startIdx);

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ];

  let iterations = 0;
  let current = startIdx;
  let found = false;

  while (open.size > 0 && iterations < MAX_A_STAR_NODES) {
    iterations++;
    let bestIdx = -1;
    let bestF = Infinity;
    for (const idx of open) {
      const f = fScore.get(idx) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        bestIdx = idx;
      }
    }
    current = bestIdx;
    if (current === endIdx) {
      found = true;
      break;
    }
    open.delete(current);
    closed.add(current);

    const cc = current % grid.cols;
    const cr = Math.floor(current / grid.cols);

    for (const [dc, dr, cost] of dirs) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (isBlockedCell(grid, nc, nr)) continue;
      // chặn cắt góc chéo xuyên qua 2 ô chặn liền kề
      if (dc !== 0 && dr !== 0 && (isBlockedCell(grid, cc + dc, cr) || isBlockedCell(grid, cc, cr + dr))) continue;
      const nIdx = cellIndex(grid, nc, nr);
      if (closed.has(nIdx)) continue;
      const tentativeG = (gScore.get(current) ?? Infinity) + cost;
      if (tentativeG < (gScore.get(nIdx) ?? Infinity)) {
        cameFrom.set(nIdx, current);
        gScore.set(nIdx, tentativeG);
        fScore.set(nIdx, tentativeG + h(nc, nr));
        open.add(nIdx);
      }
    }
  }

  if (!found) {
    // Không tìm được đường (hiếm, ví dụ bị vây kín) — đi thẳng như phương án dự phòng
    return [{ x: endX, y: endY }];
  }

  const cellPath: { c: number; r: number }[] = [];
  let cur = endIdx;
  while (cur !== startIdx) {
    cellPath.push({ c: cur % grid.cols, r: Math.floor(cur / grid.cols) });
    const prev = cameFrom.get(cur);
    if (prev === undefined) break;
    cur = prev;
  }
  cellPath.push({ c: start.c, r: start.r });
  cellPath.reverse();

  const worldPath = cellPath.map((cell) => ({
    x: cell.c * grid.cellSize + grid.cellSize / 2,
    y: cell.r * grid.cellSize + grid.cellSize / 2,
  }));
  worldPath.push({ x: endX, y: endY });

  return simplifyPath(worldPath);
}

/** Bỏ bớt các waypoint nằm gần như thẳng hàng với 2 điểm liền kề — giúp đường đi mượt hơn thay vì zic-zac theo từng ô lưới */
function simplifyPath(path: { x: number; y: number }[]): { x: number; y: number }[] {
  if (path.length <= 2) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1];
    const b = path[i];
    const c = path[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) > 6) out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}
